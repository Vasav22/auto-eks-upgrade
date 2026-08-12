import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpgradeJobEntity } from '../../../database/entities/upgrade-job.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { ValidationService } from '../../clusters/services/validation.service';
import { VersionService } from '../../clusters/services/version.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { CreateUpgradeDto } from '../dto/create-upgrade.dto';
import { UpdateClusterVersionCommand } from '@aws-sdk/client-eks';

@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(
    @InjectRepository(UpgradeJobEntity)
    private readonly upgradeRepository: Repository<UpgradeJobEntity>,
    private readonly clusterService: ClusterService,
    private readonly validationService: ValidationService,
    private readonly versionService: VersionService,
    private readonly auditService: AuditService,
  ) {}

  async createUpgradeJob(
    dto: CreateUpgradeDto,
    actorId: string,
  ): Promise<UpgradeJobEntity> {
    const cluster = await this.clusterService.getClusterById(dto.clusterId);

    // Validate version is eligible
    if (!this.versionService.isVersionValid(dto.targetVersion)) {
      throw new BadRequestException(
        `Invalid target version: ${dto.targetVersion}`,
      );
    }

    // Validate upgrade path
    if (
      !this.versionService.canUpgradeDirectly(
        cluster.eksVersion,
        dto.targetVersion,
      )
    ) {
      throw new BadRequestException(
        `Cannot upgrade directly from ${cluster.eksVersion} to ${dto.targetVersion}. Maximum version skip is 2.`,
      );
    }

    // Check for existing in-progress upgrade
    const existingUpgrade = await this.upgradeRepository.findOne({
      where: {
        cluster: { id: cluster.id },
        status: 'IN_PROGRESS' as any,
      },
    });

    if (existingUpgrade) {
      throw new BadRequestException(
        `Cluster ${cluster.clusterName} already has an upgrade in progress (Job ID: ${existingUpgrade.id})`,
      );
    }

    // Validate control plane upgrade
    // Note: In a real implementation, we'd fetch node group versions here
    const nodeGroupVersions: string[] = []; // TODO: Fetch from AWS
    const validationResult =
      this.validationService.validateControlPlaneUpgrade(
        cluster.eksVersion,
        dto.targetVersion,
        nodeGroupVersions,
      );

    if (!validationResult.isValid) {
      throw new BadRequestException(
        `Validation failed: ${validationResult.errors.join(', ')}`,
      );
    }

    // Create upgrade job
    const upgradeJob = this.upgradeRepository.create({
      clusterId: cluster.id,
      fromVersion: cluster.eksVersion || 'unknown',
      toVersion: dto.targetVersion,
      status: 'PENDING',
      jobType: 'VERSION_UPGRADE',
      initiatedBy: actorId,
    });

    const savedJob = await this.upgradeRepository.save(upgradeJob);

    await this.auditService.record({
      actorId,
      actorRole: 'operator',
      action: AuditEventType.DATA_MUTATION,
      resourceType: 'upgrade_job',
      resourceId: savedJob.id,
      changeDetail: {
        clusterId: cluster.id,
        clusterName: cluster.clusterName,
        fromVersion: cluster.eksVersion,
        toVersion: dto.targetVersion,
      },
    });

    this.logger.log(
      `Created upgrade job ${savedJob.id} for cluster ${cluster.clusterName}: ${cluster.eksVersion} -> ${dto.targetVersion}`,
    );

    return savedJob;
  }

  async getUpgradeJob(id: string): Promise<UpgradeJobEntity> {
    const job = await this.upgradeRepository.findOne({
      where: { id },
      relations: ['cluster', 'cluster.account'],
    });

    if (!job) {
      throw new NotFoundException(`Upgrade job with ID ${id} not found`);
    }

    return job;
  }

  async listUpgradeJobs(clusterId?: string): Promise<UpgradeJobEntity[]> {
    if (clusterId) {
      return this.upgradeRepository.find({
        where: { cluster: { id: clusterId } },
        relations: ['cluster', 'cluster.account'],
        order: { createdAt: 'DESC' },
      });
    }

    return this.upgradeRepository.find({
      relations: ['cluster', 'cluster.account'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async executeUpgradeJob(id: string, actorId: string): Promise<UpgradeJobEntity> {
    const job = await this.getUpgradeJob(id);

    if (job.status?.toUpperCase() !== 'PENDING') {
      throw new BadRequestException(
        `Can only execute PENDING jobs — current status: ${job.status}`,
      );
    }

    const { client, cluster } = await this.clusterService.getEksClientForCluster(job.clusterId);

    this.logger.log(
      `Executing control plane upgrade for cluster ${cluster.clusterName}: ${job.fromVersion} → ${job.toVersion}`,
    );

    const response = await client.send(
      new UpdateClusterVersionCommand({
        name: cluster.clusterName,
        version: job.toVersion,
      }),
    );

    const awsUpdateId = response.update?.id ?? null;

    job.status = 'in_progress';
    (job as any).awsUpdateId = awsUpdateId;
    (job as any).startedAt = new Date();

    const savedJob = await this.upgradeRepository.save(job);

    await this.auditService.record({
      actorId,
      actorRole: 'operator',
      action: AuditEventType.DATA_MUTATION,
      resourceType: 'upgrade_job',
      resourceId: job.id,
      changeDetail: {
        action: 'executed',
        clusterName: cluster.clusterName,
        fromVersion: job.fromVersion,
        toVersion: job.toVersion,
        awsUpdateId,
      },
    });

    this.logger.log(`Control plane upgrade started — AWS update ID: ${awsUpdateId}`);
    return savedJob;
  }

  async cancelUpgradeJob(id: string, actorId: string): Promise<UpgradeJobEntity> {
    const job = await this.getUpgradeJob(id);

    const normalizedStatus = job.status?.toUpperCase();
    if (normalizedStatus !== 'PENDING' && normalizedStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot cancel upgrade job in status: ${job.status}`,
      );
    }

    const previousStatus = job.status;
    job.status = 'cancelled';
    job.completedAt = new Date();

    const savedJob = await this.upgradeRepository.save(job);

    await this.auditService.record({
      actorId,
      actorRole: 'operator',
      action: AuditEventType.DATA_MUTATION,
      resourceType: 'upgrade_job',
      resourceId: job.id,
      changeDetail: {
        action: 'cancelled',
        previousStatus,
      },
    });

    this.logger.log(`Cancelled upgrade job ${id}`);

    return savedJob;
  }
}
