import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EKS, UpdateNodegroupVersionCommand, DescribeNodegroupCommand } from '@aws-sdk/client-eks';
import { NodeGroupEntity } from '../entities/node-group.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { EncryptionService } from '../../clusters/services/encryption.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { ValidationService } from '../../clusters/services/validation.service';
import { ActivityLogService } from '../../upgrades/services/activity-log.service';
import { UpgradeJobEntity } from '../../../database/entities/upgrade-job.entity';

export interface NodeGroupSequenceResult {
  steps: Array<{
    nodeGroupId: string;
    nodeGroupName: string;
    stepOrder: number;
    fromVersion: string;
    toVersion: string;
  }>;
  totalSteps: number;
}

@Injectable()
export class NodeGroupSequencingService {
  private readonly logger = new Logger(NodeGroupSequencingService.name);

  constructor(
    @InjectRepository(NodeGroupEntity)
    private readonly nodeGroupRepository: Repository<NodeGroupEntity>,
    @InjectQueue('upgrade-poll')
    private readonly pollQueue: Queue,
    private readonly clusterService: ClusterService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly validationService: ValidationService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async buildUpgradeSequence(
    upgradeJob: UpgradeJobEntity,
    actorId: string,
  ): Promise<NodeGroupSequenceResult> {
    const nodeGroups = await this.nodeGroupRepository.find({
      where: { cluster: { id: upgradeJob.cluster.id } },
      order: { upgradeOrder: 'ASC', name: 'ASC' },
    });

    if (nodeGroups.length === 0) {
      return { steps: [], totalSteps: 0 };
    }

    const currentVersions = nodeGroups.map((ng) => ng.currentVersion);
    const skewValidation = this.validationService.validateVersionSkew(
      upgradeJob.cluster.currentVersion,
      currentVersions,
    );

    if (!skewValidation.valid) {
      throw new BadRequestException(
        `Node group version skew validation failed: ${skewValidation.errors.join(', ')}`,
      );
    }

    const steps = nodeGroups.map((ng, index) => ({
      nodeGroupId: ng.id,
      nodeGroupName: ng.nodeGroupName,
      stepOrder: ng.upgradeOrder ?? index + 1,
      fromVersion: ng.currentVersion,
      toVersion: upgradeJob.targetVersion,
    }));

    steps.sort((a, b) => a.stepOrder - b.stepOrder);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'upgrade_job',
      targetId: upgradeJob.id,
      metadata: {
        event: 'sequence_built',
        nodeGroupCount: steps.length,
        steps: steps.map((s) => ({ name: s.nodeGroupName, order: s.stepOrder })),
      },
    });

    return { steps, totalSteps: steps.length };
  }

  async executeNodeGroupUpgrade(
    upgradeJob: UpgradeJobEntity,
    nodeGroup: NodeGroupEntity,
    targetVersion: string,
    actorId: string,
  ): Promise<{ awsUpdateId: string }> {
    const cluster = upgradeJob.cluster;

    if (!cluster.account) {
      throw new BadRequestException('Cluster account not loaded');
    }

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

    const updateResult = await eks.send(
      new UpdateNodegroupVersionCommand({
        clusterName: cluster.clusterName,
        nodegroupName: nodeGroup.nodeGroupName,
        version: targetVersion,
        force: false,
      }),
    );

    const awsUpdateId = updateResult.update?.id ?? 'unknown';

    nodeGroup.status = 'UPDATING';
    nodeGroup.targetVersion = targetVersion;
    await this.nodeGroupRepository.save(nodeGroup);

    await this.activityLogService.logActivity(upgradeJob, 'NODE_GROUP_UPGRADE_STARTED', {
      nodeGroupId: nodeGroup.id,
      nodeGroupName: nodeGroup.nodeGroupName,
      fromVersion: nodeGroup.currentVersion,
      toVersion: targetVersion,
      awsUpdateId,
    });

    this.logger.log(
      `Started node group upgrade: ${nodeGroup.nodeGroupName} to ${targetVersion}, awsUpdateId=${awsUpdateId}`,
    );

    return { awsUpdateId };
  }

  async pollNodeGroupStatus(
    clusterId: string,
    nodeGroupName: string,
    clusterName: string,
    credentials: Record<string, string>,
    region: string,
  ): Promise<{ status: string; version: string; nodesUpdated: number; nodesTotal: number }> {
    const eks = new EKS({
      region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const result = await eks.send(
      new DescribeNodegroupCommand({ clusterName, nodegroupName: nodeGroupName }),
    );

    const ng = result.nodegroup;
    const scalingConfig = ng?.scalingConfig;

    return {
      status: ng?.status ?? 'UNKNOWN',
      version: ng?.version ?? 'unknown',
      nodesUpdated: 0,
      nodesTotal: scalingConfig?.desiredSize ?? 0,
    };
  }

  async markNodeGroupComplete(nodeGroup: NodeGroupEntity, newVersion: string): Promise<void> {
    nodeGroup.status = 'ACTIVE';
    nodeGroup.currentVersion = newVersion;
    nodeGroup.targetVersion = undefined as any;
    nodeGroup.lastSyncedAt = new Date();
    await this.nodeGroupRepository.save(nodeGroup);
  }
}
