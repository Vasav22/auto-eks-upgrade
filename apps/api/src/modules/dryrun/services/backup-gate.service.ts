import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';

export interface BackupCheckResult {
  hasRecentBackup: boolean;
  lastBackupTime?: string;
  backupAgeHours?: number;
  backupSource?: string;
  overrideRecorded?: boolean;
  overrideReason?: string;
  pass: boolean;
}

const MAX_BACKUP_AGE_HOURS = 24;

@Injectable()
export class BackupGateService {
  private readonly logger = new Logger(BackupGateService.name);

  constructor(
    private readonly auditService: AuditService,
  ) {}

  async checkBackupFreshness(
    cluster: ClusterEntity,
    actorId: string,
  ): Promise<BackupCheckResult> {
    this.logger.log(`Checking backup freshness for cluster ${cluster.clusterName}`);

    // In production this would check:
    // 1. Velero backup status via in-cluster health agent
    // 2. EBS snapshots from AWS Backup via EKS describe
    // 3. etcd backup records if managed etcd

    // For now, model the gate with override support
    const result: BackupCheckResult = {
      hasRecentBackup: false,
      pass: false,
    };

    // Would normally query backup records from the database or AWS
    // Returning a conservative "no backup" result to prompt operator action
    return result;
  }

  async recordBackupOverride(
    clusterId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    this.logger.warn(`Backup gate override recorded for cluster ${clusterId} by ${actorId}`);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'cluster',
      targetId: clusterId,
      metadata: {
        event: 'backup_gate_override',
        reason,
        timestamp: new Date().toISOString(),
        maxBackupAgeHours: MAX_BACKUP_AGE_HOURS,
      },
    });
  }

  async checkWithOverrideSupport(
    cluster: ClusterEntity,
    actorId: string,
    override?: { reason: string },
  ): Promise<BackupCheckResult & { overrideAllowed: boolean }> {
    const result = await this.checkBackupFreshness(cluster, actorId);

    if (!result.pass && override) {
      await this.recordBackupOverride(cluster.id, override.reason, actorId);
      return {
        ...result,
        overrideRecorded: true,
        overrideReason: override.reason,
        pass: true,
        overrideAllowed: true,
      };
    }

    return { ...result, overrideAllowed: !result.pass };
  }
}
