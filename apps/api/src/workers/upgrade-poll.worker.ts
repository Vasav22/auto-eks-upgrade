import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EKS, DescribeClusterCommand } from '@aws-sdk/client-eks';
import { UpgradeJobEntity } from '../database/entities/upgrade-job.entity';
import { ActivityLogService } from '../modules/upgrades/services/activity-log.service';
import { UpgradeEventsGateway } from '../gateways/upgrade-events.gateway';
import { AuditService } from '../modules/audit/services/audit.service';
import { AuditEventType } from '../modules/audit/enums/audit-event-type.enum';
import { ClusterService } from '../modules/clusters/services/cluster.service';
import { EncryptionService } from '../modules/clusters/services/encryption.service';

export interface UpgradePollJobData {
  upgradeJobId: string;
  clusterId: string;
  targetVersion: string;
  pollCount: number;
}

@Processor('upgrade-poll', { concurrency: 5 })
export class UpgradePollWorker extends WorkerHost {
  private readonly logger = new Logger(UpgradePollWorker.name);
  private readonly STALL_TIMEOUT_MINUTES = 30;

  constructor(
    @InjectRepository(UpgradeJobEntity)
    private readonly upgradeRepository: Repository<UpgradeJobEntity>,
    private readonly activityLogService: ActivityLogService,
    private readonly eventsGateway: UpgradeEventsGateway,
    private readonly auditService: AuditService,
    private readonly clusterService: ClusterService,
    private readonly encryptionService: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<UpgradePollJobData>): Promise<any> {
    const { upgradeJobId, clusterId, targetVersion, pollCount } = job.data;

    this.logger.log(`Polling upgrade ${upgradeJobId}, attempt #${pollCount}`);

    const upgradeJob = await this.upgradeRepository.findOne({
      where: { id: upgradeJobId },
      relations: ['cluster', 'cluster.account'],
    });

    if (!upgradeJob) {
      this.logger.warn(`Upgrade job ${upgradeJobId} not found, skipping poll`);
      return { skipped: true, reason: 'not_found' };
    }

    if (upgradeJob.status === 'COMPLETED' || upgradeJob.status === 'FAILED' || upgradeJob.status === 'CANCELLED') {
      this.logger.log(`Upgrade job ${upgradeJobId} is terminal (${upgradeJob.status}), stopping poll`);
      return { complete: true, status: upgradeJob.status };
    }

    // Check stall detection
    if (upgradeJob.startedAt) {
      const runningMinutes = (Date.now() - upgradeJob.startedAt.getTime()) / 60000;
      if (runningMinutes > this.STALL_TIMEOUT_MINUTES) {
        await this.handleStalledUpgrade(upgradeJob);
        return { stalled: true };
      }
    }

    try {
      const cluster = await this.clusterService.getClusterById(clusterId);
      const credentials = JSON.parse(
        this.encryptionService.decrypt({
          ciphertext: cluster.account.encryptedCredentials,
          nonce: cluster.account.credentialsNonce,
          tag: cluster.account.credentialsTag,
        }),
      );

      const eks = new EKS({
        region: cluster.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      const describeResult = await eks.send(
        new DescribeClusterCommand({ name: cluster.clusterName }),
      );

      const awsCluster = describeResult.cluster;
      const awsStatus = awsCluster?.status;
      const awsVersion = awsCluster?.version;

      await this.activityLogService.logActivity(upgradeJob, 'POLL_RESULT', {
        awsStatus,
        awsVersion,
        pollCount,
        timestamp: new Date().toISOString(),
      });

      // Emit sanitized progress event (no credentials)
      await this.eventsGateway.emitUpgradeEvent(upgradeJobId, 'upgrade_progress', {
        status: awsStatus,
        currentVersion: awsVersion,
        targetVersion,
        pollCount,
        message: `Cluster status: ${awsStatus}, version: ${awsVersion}`,
      });

      if (awsVersion === targetVersion && awsStatus === 'ACTIVE') {
        await this.completeUpgrade(upgradeJob, awsVersion);
        return { complete: true };
      }

      if (awsStatus === 'FAILED') {
        await this.failUpgrade(upgradeJob, 'AWS reported cluster upgrade as FAILED');
        return { failed: true };
      }

      // Not yet complete - continue polling
      return { polling: true, awsStatus, awsVersion, pollCount };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Poll failed for upgrade ${upgradeJobId}: ${msg}`);

      await this.activityLogService.logActivity(upgradeJob, 'POLL_ERROR', {
        error: msg,
        pollCount,
      });

      await this.eventsGateway.emitUpgradeEvent(upgradeJobId, 'upgrade_poll_error', {
        message: `Poll error: ${msg}`,
        pollCount,
      });

      throw error;
    }
  }

  private async completeUpgrade(upgradeJob: UpgradeJobEntity, finalVersion: string): Promise<void> {
    upgradeJob.status = 'COMPLETED' as any;
    upgradeJob.completedAt = new Date();
    await this.upgradeRepository.save(upgradeJob);

    await this.activityLogService.logActivity(upgradeJob, 'UPGRADE_COMPLETED', {
      finalVersion,
      completedAt: upgradeJob.completedAt,
    });

    await this.eventsGateway.emitUpgradeEvent(upgradeJob.id, 'upgrade_completed', {
      finalVersion,
      completedAt: upgradeJob.completedAt,
    });

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId: upgradeJob.initiatedBy,
      targetType: 'upgrade_job',
      targetId: upgradeJob.id,
      metadata: { event: 'completed', finalVersion },
    });

    this.logger.log(`Upgrade ${upgradeJob.id} completed successfully to ${finalVersion}`);
  }

  private async failUpgrade(upgradeJob: UpgradeJobEntity, reason: string): Promise<void> {
    upgradeJob.status = 'FAILED' as any;
    upgradeJob.completedAt = new Date();
    await this.upgradeRepository.save(upgradeJob);

    await this.activityLogService.logActivity(upgradeJob, 'UPGRADE_FAILED', { reason });

    await this.eventsGateway.emitUpgradeEvent(upgradeJob.id, 'upgrade_failed', { reason });

    this.logger.error(`Upgrade ${upgradeJob.id} failed: ${reason}`);
  }

  private async handleStalledUpgrade(upgradeJob: UpgradeJobEntity): Promise<void> {
    this.logger.warn(`Upgrade ${upgradeJob.id} stalled after ${this.STALL_TIMEOUT_MINUTES} minutes`);

    upgradeJob.status = 'STALLED' as any;
    await this.upgradeRepository.save(upgradeJob);

    await this.activityLogService.logActivity(upgradeJob, 'UPGRADE_STALLED', {
      stallTimeoutMinutes: this.STALL_TIMEOUT_MINUTES,
      startedAt: upgradeJob.startedAt,
    });

    await this.eventsGateway.emitUpgradeEvent(upgradeJob.id, 'upgrade_stalled', {
      message: `Upgrade stalled after ${this.STALL_TIMEOUT_MINUTES} minutes`,
      startedAt: upgradeJob.startedAt,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<UpgradePollJobData>, error: Error) {
    this.logger.error(`Poll job ${job.id} failed: ${error.message}`, error.stack);
  }
}
