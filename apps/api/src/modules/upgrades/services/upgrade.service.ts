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
      cluster,
      currentVersion: cluster.eksVersion,
      targetVersion: dto.targetVersion,
      status: dto.dryRun ? 'DRY_RUN' : 'PENDING',
      initiatedBy: actorId,
      validationErrors: validationResult.errors,
      validationWarnings: validationResult.warnings,
      dryRun: dto.dryRun || false,
    });

    const savedJob = await this.upgradeRepository.save(upgradeJob);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'upgrade_job',
      targetId: savedJob.id,
      metadata: {
        clusterId: cluster.id,
        clusterName: cluster.clusterName,
        currentVersion: cluster.eksVersion,
        targetVersion: dto.targetVersion,
        dryRun: dto.dryRun,
        warnings: validationResult.warnings,
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

  async cancelUpgradeJob(id: string, actorId: string): Promise<UpgradeJobEntity> {
    const job = await this.getUpgradeJob(id);

    if (job.status !== 'PENDING' && job.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot cancel upgrade job in status: ${job.status}`,
      );
    }

    job.status = 'CANCELLED' as any;
    job.completedAt = new Date();

    const savedJob = await this.upgradeRepository.save(job);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'upgrade_job',
      targetId: job.id,
      metadata: {
        action: 'cancelled',
        previousStatus: job.status,
      },
    });

    this.logger.log(`Cancelled upgrade job ${id}`);

    return savedJob;
  }
}
