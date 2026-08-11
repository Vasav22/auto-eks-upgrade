import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupPolicyEntity } from '../entities/backup-policy.entity';
import { BackupEntity } from '../entities/backup.entity';
import { RestoreEntity } from '../entities/restore.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { UpgradeEventsGateway } from '../../../gateways/upgrade-events.gateway';
import { HealthService } from '../../health/services/health.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly REQUIRED_RESTORE_APPROVALS = 2;

  constructor(
    @InjectRepository(BackupPolicyEntity)
    private readonly policyRepository: Repository<BackupPolicyEntity>,
    @InjectRepository(BackupEntity)
    private readonly backupRepository: Repository<BackupEntity>,
    @InjectRepository(RestoreEntity)
    private readonly restoreRepository: Repository<RestoreEntity>,
    private readonly auditService: AuditService,
    private readonly eventsGateway: UpgradeEventsGateway,
    private readonly healthService: HealthService,
  ) {}

  async createPolicy(
    clusterId: string,
    dto: Partial<BackupPolicyEntity>,
    actorId: string,
  ): Promise<BackupPolicyEntity> {
    const policy = this.policyRepository.create({
      ...dto,
      cluster: { id: clusterId } as any,
      createdBy: actorId,
    });
    return this.policyRepository.save(policy);
  }

  async triggerBackup(
    clusterId: string,
    trigger: 'MANUAL' | 'SCHEDULED' | 'PRE_UPGRADE',
    actorId: string,
    policyId?: string,
  ): Promise<BackupEntity> {
    const backupName = `backup-${clusterId.slice(0, 8)}-${Date.now()}`;

    const backup = this.backupRepository.create({
      cluster: { id: clusterId } as any,
      policy: policyId ? { id: policyId } as any : undefined,
      name: backupName,
      trigger,
      status: 'PENDING',
    });

    const saved = await this.backupRepository.save(backup);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'cluster',
      targetId: clusterId,
      metadata: { event: 'backup_triggered', trigger, backupId: saved.id, backupName },
    });

    await this.eventsGateway.emitUpgradeEvent(clusterId, 'backup_started', {
      backupId: saved.id,
      backupName,
      trigger,
    });

    // In production, create a Velero Backup CRD via the agent
    // and poll for completion
    this.simulateBackupCompletion(saved.id);

    return saved;
  }

  private async simulateBackupCompletion(backupId: string): Promise<void> {
    const backup = await this.backupRepository.findOne({ where: { id: backupId } });
    if (!backup) return;
    backup.status = 'COMPLETED';
    backup.phase = 'Completed';
    backup.startedAt = new Date();
    backup.completedAt = new Date();
    await this.backupRepository.save(backup);
  }

  async requestRestore(
    backupId: string,
    actorId: string,
    options: { includeNamespaces?: string[]; excludeNamespaces?: string[] },
  ): Promise<RestoreEntity> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
      relations: ['cluster'],
    });
    if (!backup) throw new NotFoundException(`Backup ${backupId} not found`);
    if (backup.status !== 'COMPLETED') {
      throw new BadRequestException('Can only restore from a completed backup');
    }

    const restore = this.restoreRepository.create({
      backup: { id: backupId } as any,
      cluster: backup.cluster,
      triggeredBy: actorId,
      status: 'PENDING_APPROVAL',
      approvalStatus: 'PENDING',
      includeNamespaces: options.includeNamespaces ?? [],
      excludeNamespaces: options.excludeNamespaces ?? [],
    });

    const saved = await this.restoreRepository.save(restore);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'backup',
      targetId: backupId,
      metadata: { event: 'restore_requested', restoreId: saved.id },
    });

    return saved;
  }

  async approveRestore(restoreId: string, actorId: string): Promise<RestoreEntity> {
    const restore = await this.restoreRepository.findOne({ where: { id: restoreId } });
    if (!restore) throw new NotFoundException(`Restore ${restoreId} not found`);

    const approverIds = restore.approverIds ?? [];
    if (approverIds.includes(actorId)) {
      throw new BadRequestException('Already approved by this user');
    }

    approverIds.push(actorId);
    restore.approverIds = approverIds;

    if (approverIds.length >= this.REQUIRED_RESTORE_APPROVALS) {
      restore.approvalStatus = 'APPROVED';
      restore.status = 'APPROVED';
    }

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'restore',
      targetId: restoreId,
      metadata: { event: 'restore_approved', approvalCount: approverIds.length },
    });

    return this.restoreRepository.save(restore);
  }

  async executeRestore(restoreId: string, actorId: string): Promise<RestoreEntity> {
    const restore = await this.restoreRepository.findOne({
      where: { id: restoreId },
      relations: ['cluster'],
    });
    if (!restore) throw new NotFoundException(`Restore ${restoreId} not found`);
    if (restore.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('Restore must be approved before execution');
    }

    restore.status = 'EXECUTING';
    restore.startedAt = new Date();
    await this.restoreRepository.save(restore);

    await this.eventsGateway.emitUpgradeEvent(restore.cluster.id, 'restore_started', {
      restoreId,
      clusterId: restore.cluster.id,
    });

    // Post-restore health validation
    setTimeout(async () => {
      restore.status = 'COMPLETED';
      restore.completedAt = new Date();
      await this.restoreRepository.save(restore);

      await this.eventsGateway.emitUpgradeEvent(restore.cluster.id, 'restore_completed', { restoreId });

      await this.healthService.triggerHealthCheck(restore.cluster.id, 'POST_UPGRADE', actorId, undefined);

      await this.auditService.record({
        type: AuditEventType.DATA_MUTATION,
        actorId,
        targetType: 'restore',
        targetId: restoreId,
        metadata: { event: 'restore_completed' },
      });
    }, 100);

    return restore;
  }

  async listBackups(clusterId: string): Promise<BackupEntity[]> {
    return this.backupRepository.find({
      where: { cluster: { id: clusterId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async listRestores(clusterId: string): Promise<RestoreEntity[]> {
    return this.restoreRepository.find({
      where: { cluster: { id: clusterId } },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
