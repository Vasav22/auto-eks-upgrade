import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';

interface RetentionPolicy {
  table: string;
  retentionDays: number;
  enabled: boolean;
}

@Injectable()
export class PurgeSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PurgeSchedulerService.name);

  private readonly policies: RetentionPolicy[] = [
    { table: 'sessions', retentionDays: 90, enabled: true },
    { table: 'upgrade_events', retentionDays: 730, enabled: true }, // 2 years
    { table: 'audit_records', retentionDays: 2555, enabled: true }, // 7 years for compliance
  ];

  constructor(@InjectQueue('purge') private purgeQueue: Queue) {}

  async onModuleInit() {
    this.logger.log('Purge scheduler initialized');
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleDailyPurge() {
    this.logger.log('Starting daily purge job');

    for (const policy of this.policies) {
      if (!policy.enabled) {
        this.logger.debug(`Skipping disabled policy: ${policy.table}`);
        continue;
      }

      await this.purgeQueue.add(
        'purge-table',
        {
          targetTable: policy.table,
          retentionDays: policy.retentionDays,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
          },
        },
      );

      this.logger.log(
        `Queued purge for ${policy.table} (${policy.retentionDays} days retention)`,
      );
    }
  }

  async triggerManualPurge(table: string): Promise<void> {
    const policy = this.policies.find((p) => p.table === table);
    
    if (!policy) {
      throw new Error(`No retention policy found for table: ${table}`);
    }

    await this.purgeQueue.add('purge-table', {
      targetTable: policy.table,
      retentionDays: policy.retentionDays,
    });

    this.logger.log(`Manual purge triggered for ${table}`);
  }
}
