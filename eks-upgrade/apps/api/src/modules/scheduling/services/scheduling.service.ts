import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UpgradeScheduleEntity } from '../entities/upgrade-schedule.entity';
import { ValidationService } from '../../clusters/services/validation.service';
import { ClusterService } from '../../clusters/services/cluster.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';

export interface CreateScheduleDto {
  clusterId: string;
  targetVersion: string;
  scheduledAt: string;
  dryRun?: boolean;
  maxRetries?: number;
  notes?: string;
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectRepository(UpgradeScheduleEntity)
    private readonly scheduleRepository: Repository<UpgradeScheduleEntity>,
    private readonly validationService: ValidationService,
    private readonly clusterService: ClusterService,
    private readonly auditService: AuditService,
  ) {}

  async createSchedule(dto: CreateScheduleDto, actorId: string): Promise<UpgradeScheduleEntity> {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Schedule time must be in the future');
    }

    const cluster = await this.clusterService.getClusterById(dto.clusterId);
    const upgradeValid = this.validationService.validateControlPlaneUpgrade(
      cluster.currentVersion,
      dto.targetVersion,
      [],
    );

    if (!upgradeValid.valid) {
      throw new BadRequestException(`Invalid upgrade path: ${upgradeValid.errors?.join(', ')}`);
    }

    const schedule = this.scheduleRepository.create({
      cluster: { id: dto.clusterId } as any,
      targetVersion: dto.targetVersion,
      scheduledAt,
      dryRun: dto.dryRun ?? false,
      maxRetries: dto.maxRetries ?? 1,
      createdBy: actorId,
      notes: dto.notes,
      status: 'SCHEDULED',
    });

    const saved = await this.scheduleRepository.save(schedule);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'cluster',
      targetId: dto.clusterId,
      metadata: { event: 'upgrade_scheduled', targetVersion: dto.targetVersion, scheduledAt: dto.scheduledAt },
    });

    this.logger.log(`Scheduled upgrade for cluster ${dto.clusterId} at ${scheduledAt.toISOString()}`);
    return saved;
  }

  @Cron('* * * * *') // Every minute
  async executeScheduledUpgrades(): Promise<void> {
    const now = new Date();
    const dueSchedules = await this.scheduleRepository.find({
      where: {
        status: 'SCHEDULED',
        scheduledAt: LessThanOrEqual(now),
      },
      relations: ['cluster'],
      take: 10,
    });

    for (const schedule of dueSchedules) {
      try {
        this.logger.log(`Executing scheduled upgrade ${schedule.id}`);
        schedule.status = 'RUNNING';
        await this.scheduleRepository.save(schedule);

        // Run pre-execution validation
        const cluster = await this.clusterService.getClusterById(schedule.cluster.id);
        const validation = this.validationService.validateControlPlaneUpgrade(
          cluster.currentVersion,
          schedule.targetVersion,
          [],
        );

        schedule.preValidationPassed = validation.valid;

        if (!validation.valid) {
          schedule.status = 'FAILED';
          this.logger.warn(`Schedule ${schedule.id} failed pre-validation: ${validation.errors?.join(', ')}`);
        } else {
          schedule.status = 'COMPLETED';
        }

        await this.scheduleRepository.save(schedule);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Schedule ${schedule.id} execution failed: ${msg}`);
        schedule.status = 'FAILED';
        await this.scheduleRepository.save(schedule);
      }
    }
  }

  async listSchedules(clusterId?: string): Promise<UpgradeScheduleEntity[]> {
    return this.scheduleRepository.find({
      where: clusterId ? { cluster: { id: clusterId } } : undefined,
      order: { scheduledAt: 'ASC' },
      take: 50,
    });
  }

  async cancelSchedule(scheduleId: string, actorId: string): Promise<UpgradeScheduleEntity> {
    const schedule = await this.scheduleRepository.findOne({ where: { id: scheduleId } });
    if (!schedule) throw new BadRequestException(`Schedule ${scheduleId} not found`);
    if (schedule.status !== 'SCHEDULED') throw new BadRequestException('Can only cancel SCHEDULED upgrades');

    schedule.status = 'CANCELLED';
    return this.scheduleRepository.save(schedule);
  }
}
