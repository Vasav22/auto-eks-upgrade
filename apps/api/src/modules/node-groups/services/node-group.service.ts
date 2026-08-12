import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeGroupEntity } from '../../../database/entities/node-group.entity';
import { UpgradeJobEntity } from '../../../database/entities/upgrade-job.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { CreateNodeGroupDto } from '../dto/create-node-group.dto';
import {
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
} from '@aws-sdk/client-eks';

export interface LiveNodeGroup {
  name: string;
  status: string;
  currentVersion: string;
  amiType: string | null;
  instanceTypes: string[];
  desiredSize: number;
  minSize: number;
  maxSize: number;
  labels: Record<string, string>;
  tags: Record<string, string>;
  capacityType: string | null;
}

@Injectable()
export class NodeGroupService {
  private readonly logger = new Logger(NodeGroupService.name);

  constructor(
    @InjectRepository(NodeGroupEntity)
    private readonly nodeGroupRepository: Repository<NodeGroupEntity>,
    @InjectRepository(UpgradeJobEntity)
    private readonly upgradeJobRepository: Repository<UpgradeJobEntity>,
    private readonly clusterService: ClusterService,
    private readonly auditService: AuditService,
  ) {}

  async createNodeGroup(
    dto: CreateNodeGroupDto,
    actorId: string,
  ): Promise<NodeGroupEntity> {
    const cluster = await this.clusterService.getClusterById(dto.clusterId);

    // Validate sizing
    if (dto.minSize > dto.desiredSize || dto.desiredSize > dto.maxSize) {
      throw new BadRequestException(
        'Node group sizing must satisfy: minSize <= desiredSize <= maxSize',
      );
    }

    // Check for duplicate name
    const existing = await this.nodeGroupRepository.findOne({
      where: {
        cluster: { id: cluster.id },
        nodeGroupName: dto.nodeGroupName,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Node group with name ${dto.nodeGroupName} already exists in cluster ${cluster.clusterName}`,
      );
    }

    const nodeGroup = this.nodeGroupRepository.create({
      cluster,
      nodeGroupName: dto.nodeGroupName,
      eksVersion: dto.eksVersion,
      desiredSize: dto.desiredSize,
      minSize: dto.minSize,
      maxSize: dto.maxSize,
      instanceType: dto.instanceType,
      status: 'CREATING',
    });

    const saved = await this.nodeGroupRepository.save(nodeGroup);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'node_group',
      targetId: saved.id,
      metadata: {
        action: 'created',
        clusterId: cluster.id,
        nodeGroupName: dto.nodeGroupName,
        eksVersion: dto.eksVersion,
      },
    });

    this.logger.log(
      `Created node group ${dto.nodeGroupName} for cluster ${cluster.clusterName}`,
    );

    return saved;
  }

  async getNodeGroup(id: string): Promise<NodeGroupEntity> {
    const nodeGroup = await this.nodeGroupRepository.findOne({
      where: { id },
      relations: ['cluster', 'cluster.account'],
    });

    if (!nodeGroup) {
      throw new NotFoundException(`Node group with ID ${id} not found`);
    }

    return nodeGroup;
  }

  async listNodeGroups(clusterId?: string): Promise<NodeGroupEntity[]> {
    if (clusterId) {
      return this.nodeGroupRepository.find({
        where: { cluster: { id: clusterId } },
        relations: ['cluster'],
        order: { createdAt: 'DESC' },
      });
    }

    return this.nodeGroupRepository.find({
      relations: ['cluster'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async updateNodeGroup(
    id: string,
    updates: Partial<CreateNodeGroupDto>,
    actorId: string,
  ): Promise<NodeGroupEntity> {
    const nodeGroup = await this.getNodeGroup(id);

    if (updates.desiredSize !== undefined) {
      nodeGroup.desiredSize = updates.desiredSize;
    }
    if (updates.minSize !== undefined) {
      nodeGroup.minSize = updates.minSize;
    }
    if (updates.maxSize !== undefined) {
      nodeGroup.maxSize = updates.maxSize;
    }

    // Validate sizing
    if (
      nodeGroup.minSize > nodeGroup.desiredSize ||
      nodeGroup.desiredSize > nodeGroup.maxSize
    ) {
      throw new BadRequestException(
        'Node group sizing must satisfy: minSize <= desiredSize <= maxSize',
      );
    }

    const saved = await this.nodeGroupRepository.save(nodeGroup);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'node_group',
      targetId: nodeGroup.id,
      metadata: {
        action: 'updated',
        updates,
      },
    });

    this.logger.log(`Updated node group ${nodeGroup.nodeGroupName}`);

    return saved;
  }

  async deleteNodeGroup(id: string, actorId: string): Promise<void> {
    const nodeGroup = await this.getNodeGroup(id);

    await this.nodeGroupRepository.remove(nodeGroup);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'node_group',
      targetId: id,
      metadata: {
        action: 'deleted',
        nodeGroupName: nodeGroup.nodeGroupName,
      },
    });

    this.logger.log(`Deleted node group ${nodeGroup.nodeGroupName}`);
  }

  async getNodeGroupsByCluster(clusterId: string): Promise<NodeGroupEntity[]> {
    return this.nodeGroupRepository.find({
      where: { cluster: { id: clusterId } },
      order: { createdAt: 'ASC' },
    });
  }

  async countNodeGroups(clusterId: string): Promise<number> {
    return this.nodeGroupRepository.count({
      where: { cluster: { id: clusterId } },
    });
  }

  async liveListNodeGroups(clusterId: string): Promise<LiveNodeGroup[]> {
    this.logger.log(`liveListNodeGroups: getting EKS client for cluster ${clusterId}`);
    const { client, cluster } = await this.clusterService.getEksClientForCluster(clusterId);
    this.logger.log(`liveListNodeGroups: calling ListNodegroups for ${cluster.clusterName} in ${cluster.region}`);

    const listRes = await client.send(
      new ListNodegroupsCommand({ clusterName: cluster.clusterName }),
    );
    this.logger.log(`liveListNodeGroups: found ${listRes.nodegroups?.length ?? 0} node groups`);

    const names = listRes.nodegroups ?? [];
    if (names.length === 0) return [];

    const details = await Promise.allSettled(
      names.map((name) =>
        client.send(new DescribeNodegroupCommand({
          clusterName: cluster.clusterName,
          nodegroupName: name,
        })),
      ),
    );

    return details
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => {
        const ng = r.value.nodegroup;
        return {
          name: ng.nodegroupName,
          status: ng.status ?? 'UNKNOWN',
          currentVersion: ng.version ?? '',
          amiType: ng.amiType ?? null,
          instanceTypes: ng.instanceTypes ?? [],
          desiredSize: ng.scalingConfig?.desiredSize ?? 0,
          minSize: ng.scalingConfig?.minSize ?? 0,
          maxSize: ng.scalingConfig?.maxSize ?? 0,
          labels: ng.labels ?? {},
          tags: ng.tags ?? {},
          capacityType: ng.capacityType ?? null,
        };
      });
  }

  async queueNodeGroupUpgrades(
    clusterId: string,
    nodeGroupNames: string[],
    targetVersion: string,
    actorId: string,
  ): Promise<{ name: string; jobId: string; status: string }[]> {
    const cluster = await this.clusterService.getClusterById(clusterId);

    const results: { name: string; jobId: string; status: string }[] = [];

    for (const name of nodeGroupNames) {
      const job = this.upgradeJobRepository.create({
        clusterId: cluster.id,
        fromVersion: cluster.eksVersion || 'unknown',
        toVersion: targetVersion,
        jobType: 'NODE_GROUP_UPGRADE',
        status: 'pending',
        initiatedBy: actorId,
        errorDetail: { nodeGroupName: name } as any,
      });
      const saved = await this.upgradeJobRepository.save(job);
      results.push({ name, jobId: saved.id, status: 'queued' });
    }

    await this.auditService.record({
      actorId,
      actorRole: 'operator',
      action: AuditEventType.DATA_MUTATION,
      resourceType: 'node_groups',
      resourceId: clusterId,
      changeDetail: {
        action: 'node_group_upgrades_queued',
        clusterName: cluster.clusterName,
        targetVersion,
        nodeGroups: results,
      },
    });

    this.logger.log(`Queued ${results.length} node group upgrade job(s) for cluster ${cluster.clusterName}`);
    return results;
  }

  async listNodeGroupJobs(clusterId: string): Promise<UpgradeJobEntity[]> {
    return this.upgradeJobRepository.find({
      where: { clusterId, jobType: 'NODE_GROUP_UPGRADE' } as any,
      order: { createdAt: 'DESC' },
    });
  }
}
