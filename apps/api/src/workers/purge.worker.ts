import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThan } from 'typeorm';
import { AuditService } from '../modules/audit/services/audit.service';
import { AuditEventType } from '../modules/audit/enums/audit-event-type.enum';
import { SessionRepository } from '../auth/repositories/session.repository';

@Processor('purge')
export class PurgeWorker extends WorkerHost {
  private readonly logger = new Logger(PurgeWorker.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private auditService: AuditService,
    private sessionRepository: SessionRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { targetTable, retentionDays } = job.data;
    this.logger.log(
      `Starting purge for ${targetTable} with ${retentionDays} day retention`,
    );

    try {
      let purgedCount = 0;

      switch (targetTable) {
        case 'sessions':
          purgedCount = await this.purgeSessions(retentionDays);
          break;
        case 'upgrade_events':
          purgedCount = await this.purgeUpgradeEvents(retentionDays);
          break;
        case 'audit_records':
          purgedCount = await this.purgeAuditRecords(retentionDays);
          break;
        default:
          throw new Error(`Unknown table: ${targetTable}`);
      }

      // Write audit record of purge
      await this.auditService.record({
        actorId: 'system',
        actorRole: 'system',
        action: AuditEventType.PURGE_EXECUTED,
        resourceType: targetTable,
        resourceId: `purge-${Date.now()}`,
        changeDetail: {
          retention_days: retentionDays,
          purged_count: purgedCount,
          executed_at: new Date().toISOString(),
        },
      });

      this.logger.log(
        `Purge completed for ${targetTable}: ${purgedCount} records deleted`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Purge failed for ${targetTable}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async purgeSessions(retentionDays: number): Promise<number> {
    return this.sessionRepository.purgeOlderThan(retentionDays);
  }

  private async purgeUpgradeEvents(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.dataSource.query(
      `DELETE FROM upgrade_events WHERE occurred_at < $1`,
      [cutoffDate],
    );

    return result[1] || 0; // PostgreSQL returns [command, rowCount]
  }

  private async purgeAuditRecords(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Note: This violates immutability for compliance
    // Only purge old records beyond retention requirement
    const result = await this.dataSource.query(
      `DELETE FROM audit_records WHERE occurred_at < $1`,
      [cutoffDate],
    );

    return result[1] || 0;
  }
}
