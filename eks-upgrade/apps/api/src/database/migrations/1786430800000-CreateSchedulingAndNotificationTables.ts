import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSchedulingAndNotificationTables1786430800000 implements MigrationInterface {
  name = 'CreateSchedulingAndNotificationTables1786430800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'upgrade_schedules',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'target_version', type: 'varchar', length: '16' },
          { name: 'scheduled_at', type: 'timestamptz', isNullable: false },
          { name: 'cron_expression', type: 'varchar', length: '64', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'SCHEDULED'" },
          { name: 'dry_run', type: 'boolean', default: false },
          { name: 'max_retries', type: 'integer', default: 1 },
          { name: 'retry_count', type: 'integer', default: 0 },
          { name: 'upgrade_job_id', type: 'uuid', isNullable: true },
          { name: 'pre_validation_passed', type: 'boolean', isNullable: true },
          { name: 'created_by', type: 'uuid' },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notification_channels',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'name', type: 'varchar', length: '128' },
          { name: 'type', type: 'varchar', length: '32', comment: 'SLACK | EMAIL | WEBHOOK | PAGERDUTY' },
          { name: 'config', type: 'jsonb', default: "'{}'" },
          { name: 'enabled', type: 'boolean', default: true },
          { name: 'events', type: 'jsonb', default: "'[]'" },
          { name: 'created_by', type: 'uuid' },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'channel_id', type: 'uuid', isNullable: false },
          { name: 'event_type', type: 'varchar', length: '64' },
          { name: 'subject', type: 'varchar', length: '255' },
          { name: 'body', type: 'text' },
          { name: 'status', type: 'varchar', length: '32', default: "'PENDING'" },
          { name: 'sent_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', default: "'{}'" },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('upgrade_schedules', new TableIndex({ name: 'idx_schedules_cluster_id', columnNames: ['cluster_id'] }));
    await queryRunner.createIndex('upgrade_schedules', new TableIndex({ name: 'idx_schedules_status', columnNames: ['status'] }));
    await queryRunner.createIndex('upgrade_schedules', new TableIndex({ name: 'idx_schedules_scheduled_at', columnNames: ['scheduled_at'] }));
    await queryRunner.createIndex('notifications', new TableIndex({ name: 'idx_notifications_status', columnNames: ['status'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notifications');
    await queryRunner.dropTable('notification_channels');
    await queryRunner.dropTable('upgrade_schedules');
  }
}
