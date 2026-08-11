import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../entities/campaign.entity';
import { CampaignTargetEntity } from '../entities/campaign-target.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { ValidationService } from '../../clusters/services/validation.service';
import { UpgradeEventsGateway } from '../../../gateways/upgrade-events.gateway';

export interface CreateCampaignDto {
  name: string;
  description?: string;
  targetVersion: string;
  clusterIds: string[];
  dryRun?: boolean;
  maxParallel?: number;
  scheduledAt?: string;
}

export interface CampaignProgressSummary {
  campaignId: string;
  name: string;
  status: string;
  targetVersion: string;
  totalTargets: number;
  pendingTargets: number;
  runningTargets: number;
  completedTargets: number;
  failedTargets: number;
  ineligibleTargets: number;
  progressPercent: number;
  estimatedTimeRemainingMinutes?: number;
}

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignTargetEntity)
    private readonly targetRepository: Repository<CampaignTargetEntity>,
    private readonly clusterService: ClusterService,
    private readonly auditService: AuditService,
    private readonly validationService: ValidationService,
    private readonly eventsGateway: UpgradeEventsGateway,
  ) {}

  async createCampaign(dto: CreateCampaignDto, actorId: string): Promise<CampaignEntity> {
    if (!dto.clusterIds?.length) {
      throw new BadRequestException('Campaign must have at least one cluster target');
    }

    const campaign = this.campaignRepository.create({
      name: dto.name,
      description: dto.description,
      targetVersion: dto.targetVersion,
      dryRun: dto.dryRun ?? false,
      maxParallel: dto.maxParallel ?? 1,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      status: 'DRAFT',
      createdBy: actorId,
    });

    const saved = await this.campaignRepository.save(campaign);

    const targets = dto.clusterIds.map((clusterId, idx) =>
      this.targetRepository.create({
        campaign: saved,
        cluster: { id: clusterId } as any,
        status: 'PENDING',
        sortOrder: idx + 1,
      }),
    );

    await this.targetRepository.save(targets);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'campaign',
      targetId: saved.id,
      metadata: {
        event: 'campaign_created',
        targetVersion: dto.targetVersion,
        targetCount: dto.clusterIds.length,
        dryRun: dto.dryRun,
      },
    });

    this.logger.log(`Campaign ${saved.id} created with ${targets.length} targets`);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<CampaignEntity> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['targets', 'targets.cluster'],
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async list(actorId: string): Promise<CampaignEntity[]> {
    return this.campaignRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['targets'],
      take: 100,
    });
  }

  async getProgressSummary(id: string): Promise<CampaignProgressSummary> {
    const campaign = await this.findById(id);
    const targets = campaign.targets;

    const counts = {
      PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, SKIPPED: 0, INELIGIBLE: 0,
    };
    for (const t of targets) {
      counts[t.status as keyof typeof counts] = (counts[t.status as keyof typeof counts] ?? 0) + 1;
    }

    const done = counts.COMPLETED + counts.FAILED + counts.SKIPPED + counts.INELIGIBLE;
    const progressPercent = targets.length > 0 ? Math.round((done / targets.length) * 100) : 0;

    return {
      campaignId: id,
      name: campaign.name,
      status: campaign.status,
      targetVersion: campaign.targetVersion,
      totalTargets: targets.length,
      pendingTargets: counts.PENDING,
      runningTargets: counts.RUNNING,
      completedTargets: counts.COMPLETED,
      failedTargets: counts.FAILED,
      ineligibleTargets: counts.INELIGIBLE,
      progressPercent,
    };
  }

  async startCampaign(id: string, actorId: string): Promise<CampaignEntity> {
    const campaign = await this.findById(id);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
      throw new BadRequestException(`Cannot start campaign in status ${campaign.status}`);
    }

    campaign.status = 'RUNNING';
    campaign.startedAt = campaign.startedAt ?? new Date();
    await this.campaignRepository.save(campaign);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'campaign',
      targetId: id,
      metadata: { event: 'campaign_started' },
    });

    await this.eventsGateway.emitUpgradeEvent(id, 'campaign_started', {
      campaignId: id,
      targetVersion: campaign.targetVersion,
    });

    return campaign;
  }

  async pauseCampaign(id: string, actorId: string): Promise<CampaignEntity> {
    const campaign = await this.findById(id);
    if (campaign.status !== 'RUNNING') {
      throw new BadRequestException('Can only pause a RUNNING campaign');
    }
    campaign.status = 'PAUSED';
    await this.campaignRepository.save(campaign);
    return campaign;
  }

  async screenEligibility(campaignId: string, actorId: string): Promise<void> {
    const campaign = await this.findById(campaignId);

    for (const target of campaign.targets) {
      try {
        const cluster = await this.clusterService.getClusterById(target.cluster.id);
        const reasons: string[] = [];

        const upgradeValid = this.validationService.validateControlPlaneUpgrade(
          cluster.currentVersion,
          campaign.targetVersion,
          [],
        );

        if (!upgradeValid.valid) {
          reasons.push(...(upgradeValid.errors ?? []));
        }

        target.eligibilityPass = upgradeValid.valid;
        target.eligibilityReasons = reasons;
        target.eligibilityCheckedAt = new Date();

        if (!upgradeValid.valid) {
          target.status = 'INELIGIBLE';
        }

        await this.targetRepository.save(target);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        target.eligibilityPass = false;
        target.eligibilityReasons = [msg];
        target.status = 'INELIGIBLE';
        await this.targetRepository.save(target);
      }
    }

    this.logger.log(`Eligibility screening complete for campaign ${campaignId}`);
  }
}
