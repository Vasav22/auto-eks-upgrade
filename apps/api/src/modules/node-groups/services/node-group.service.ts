import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeGroupEntity } from '../../../database/entities/node-group.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { CreateNodeGroupDto } from '../dto/create-node-group.dto';

@Injectable()
export class NodeGroupService {
  private readonly logger = new Logger(NodeGroupService.name);

  constructor(
    @InjectRepository(NodeGroupEntity)
    private readonly nodeGroupRepository: Repository<NodeGroupEntity>,
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
}
