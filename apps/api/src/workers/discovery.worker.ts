import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClusterService } from '../modules/clusters/services/cluster.service';
import { DiscoverClustersDto } from '../modules/clusters/dto/discover-clusters.dto';
import { AuditService } from '../modules/audit/services/audit.service';
import { AuditEventType } from '../modules/audit/enums/audit-event-type.enum';

export interface DiscoveryJobData {
  accountId: string;
  regions?: string[];
  triggeredBy: string;
}

@Processor('discovery', {
  concurrency: 3,
  limiter: {
    max: 10,
    duration: 60000,
  },
})
export class DiscoveryWorker extends WorkerHost {
  private readonly logger = new Logger(DiscoveryWorker.name);

  constructor(
    private readonly clusterService: ClusterService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<DiscoveryJobData>): Promise<any> {
    const { accountId, regions, triggeredBy } = job.data;

    this.logger.log(
      `Starting discovery job ${job.id} for account ${accountId}`,
    );

    try {
      const dto: DiscoverClustersDto = {
        accountId,
        regions,
      };

      const result = await this.clusterService.discoverClusters(
        dto,
        triggeredBy,
      );

      await job.updateProgress(100);

      if (result.errors.length > 0) {
        this.logger.warn(
          `Discovery job ${job.id} completed with ${result.errors.length} errors`,
        );
        await this.auditService.record({
          type: AuditEventType.ADMIN_ACTION,
          actorId: triggeredBy,
          targetType: 'discovery_job',
          targetId: job.id,
          metadata: {
            accountId,
            ...result,
            status: 'completed_with_errors',
          },
        });

        return {
          ...result,
          status: 'completed_with_errors',
          jobId: job.id,
        };
      }

      this.logger.log(
        `Discovery job ${job.id} completed successfully: ${result.discovered} discovered, ${result.registered} registered, ${result.updated} updated`,
      );

      return {
        ...result,
        status: 'success',
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error(
        `Discovery job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.auditService.record({
        type: AuditEventType.ADMIN_ACTION,
        actorId: triggeredBy,
        targetType: 'discovery_job',
        targetId: job.id,
        metadata: {
          accountId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DiscoveryJobData>) {
    this.logger.log(`Discovery job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DiscoveryJobData>, error: Error) {
    this.logger.error(
      `Discovery job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Discovery job ${jobId} stalled`);
  }
}
