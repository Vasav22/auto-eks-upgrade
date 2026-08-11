import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EKS,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
} from '@aws-sdk/client-eks';
import { NodeGroupEntity } from '../entities/node-group.entity';
import { EncryptionService } from '../../clusters/services/encryption.service';
import { ActivityLogService } from '../../upgrades/services/activity-log.service';
import { UpgradeJobEntity } from '../../../database/entities/upgrade-job.entity';

export interface EvictionReport {
  nodeGroupName: string;
  podsEvicted: number;
  podsBlocked: number;
  blockedPods: Array<{
    podName: string;
    namespace: string;
    reason: string;
    pdbName?: string;
  }>;
  volumeAttachmentIssues: Array<{
    volumeId: string;
    pvName: string;
    status: string;
    attachedNode?: string;
  }>;
  evictionStatus: 'CLEAN' | 'PARTIAL' | 'BLOCKED';
  timestamp: string;
}

export interface NodeGroupUpgradeHealthReport {
  upgradeJobId: string;
  clusterId: string;
  nodeGroupReports: EvictionReport[];
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  blockedNodeGroups: string[];
  generatedAt: string;
}

@Injectable()
export class EvictionReporterService {
  private readonly logger = new Logger(EvictionReporterService.name);

  constructor(
    @InjectRepository(NodeGroupEntity)
    private readonly nodeGroupRepository: Repository<NodeGroupEntity>,
    private readonly encryptionService: EncryptionService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async generateEvictionReport(
    upgradeJob: UpgradeJobEntity,
    nodeGroupName: string,
  ): Promise<EvictionReport> {
    this.logger.log(`Generating eviction report for node group ${nodeGroupName}`);

    // In a real implementation, this would call the Kubernetes API
    // via the health agent to get pod eviction and PDB status.
    // Here we model the data structure and integrate with AWS EKS
    // describe-nodegroup for resource counts.

    const cluster = upgradeJob.cluster;

    const report: EvictionReport = {
      nodeGroupName,
      podsEvicted: 0,
      podsBlocked: 0,
      blockedPods: [],
      volumeAttachmentIssues: [],
      evictionStatus: 'CLEAN',
      timestamp: new Date().toISOString(),
    };

    try {
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

      const ngResult = await eks.send(
        new DescribeNodegroupCommand({
          clusterName: cluster.clusterName,
          nodegroupName: nodeGroupName,
        }),
      );

      const health = ngResult.nodegroup?.health;
      if (health?.issues && health.issues.length > 0) {
        for (const issue of health.issues) {
          if (issue.code === 'PodEvictionFailure') {
            const resourceIds = issue.resourceIds ?? [];
            for (const podRef of resourceIds) {
              const parts = podRef.split('/');
              report.blockedPods.push({
                podName: parts[1] ?? podRef,
                namespace: parts[0] ?? 'default',
                reason: issue.message ?? 'Pod eviction failed',
              });
            }
            report.podsBlocked += resourceIds.length;
          }

          if (issue.code === 'VolumeInUse' || issue.code?.includes('Volume')) {
            for (const volId of issue.resourceIds ?? []) {
              report.volumeAttachmentIssues.push({
                volumeId: volId,
                pvName: `pvc-${volId.slice(-8)}`,
                status: issue.message ?? 'Volume attachment issue',
              });
            }
          }
        }

        report.evictionStatus =
          report.podsBlocked > 0
            ? 'BLOCKED'
            : report.volumeAttachmentIssues.length > 0
              ? 'PARTIAL'
              : 'CLEAN';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not query EKS health for ${nodeGroupName}: ${msg}`);
    }

    await this.activityLogService.logActivity(upgradeJob, 'EVICTION_REPORT', {
      nodeGroupName,
      evictionStatus: report.evictionStatus,
      blockedPodCount: report.podsBlocked,
      volumeIssueCount: report.volumeAttachmentIssues.length,
    });

    return report;
  }

  async generateHealthReport(upgradeJob: UpgradeJobEntity): Promise<NodeGroupUpgradeHealthReport> {
    const nodeGroups = await this.nodeGroupRepository.find({
      where: { cluster: { id: upgradeJob.cluster.id } },
    });

    const nodeGroupReports = await Promise.all(
      nodeGroups.map((ng) => this.generateEvictionReport(upgradeJob, ng.nodeGroupName)),
    );

    const blockedNodeGroups = nodeGroupReports
      .filter((r) => r.evictionStatus === 'BLOCKED')
      .map((r) => r.nodeGroupName);

    const hasBlocked = blockedNodeGroups.length > 0;
    const hasPartial = nodeGroupReports.some((r) => r.evictionStatus === 'PARTIAL');

    return {
      upgradeJobId: upgradeJob.id,
      clusterId: upgradeJob.cluster.id,
      nodeGroupReports,
      overallStatus: hasBlocked ? 'CRITICAL' : hasPartial ? 'WARNING' : 'HEALTHY',
      blockedNodeGroups,
      generatedAt: new Date().toISOString(),
    };
  }
}
