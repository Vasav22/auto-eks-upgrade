import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateBackupTables1786430700000 implements MigrationInterface {
  name = 'CreateBackupTables1786430700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'backup_policies',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '128' },
          { name: 'schedule_cron', type: 'varchar', length: '64', default: "'0 2 * * *'" },
          { name: 'retention_days', type: 'integer', default: 30 },
          { name: 'include_namespaces', type: 'jsonb', default: "'[]'" },
          { name: 'exclude_namespaces', type: 'jsonb', default: "'[\"kube-system\"]'" },
          { name: 'include_resources', type: 'jsonb', default: "'[]'" },
          { name: 'storage_location', type: 'varchar', length: '255', isNullable: true },
          { name: 'enabled', type: 'boolean', default: true },
          { name: 'created_by', type: 'uuid' },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'backups',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'policy_id', type: 'uuid', isNullable: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'trigger', type: 'varchar', length: '32', default: "'SCHEDULED'", comment: 'SCHEDULED | MANUAL | PRE_UPGRADE' },
          { name: 'status', type: 'varchar', length: '32', default: "'PENDING'" },
          { name: 'velero_backup_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'phase', type: 'varchar', length: '32', isNullable: true },
          { name: 'included_namespaces', type: 'jsonb', default: "'[]'" },
          { name: 'resource_count', type: 'integer', default: 0 },
          { name: 'size_bytes', type: 'bigint', default: 0 },
          { name: 'storage_location', type: 'varchar', length: '255', isNullable: true },
          { name: 'expires_at', type: 'timestamptz', isNullable: true },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'restores',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'backup_id', type: 'uuid', isNullable: false },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'triggered_by', type: 'uuid' },
          { name: 'status', type: 'varchar', length: '32', default: "'PENDING_APPROVAL'" },
          { name: 'approval_status', type: 'varchar', length: '32', default: "'PENDING'" },
          { name: 'approver_ids', type: 'jsonb', default: "'[]'" },
          { name: 'include_namespaces', type: 'jsonb', default: "'[]'" },
          { name: 'exclude_namespaces', type: 'jsonb', default: "'[]'" },
          { name: 'velero_restore_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'phase', type: 'varchar', length: '32', isNullable: true },
          { name: 'resource_outcomes', type: 'jsonb', default: "'[]'" },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'post_restore_health_check_id', type: 'uuid', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('backups', new TableIndex({ name: 'idx_backups_cluster_id', columnNames: ['cluster_id'] }));
    await queryRunner.createIndex('backups', new TableIndex({ name: 'idx_backups_status', columnNames: ['status'] }));
    await queryRunner.createIndex('restores', new TableIndex({ name: 'idx_restores_backup_id', columnNames: ['backup_id'] }));
    await queryRunner.createIndex('restores', new TableIndex({ name: 'idx_restores_cluster_id', columnNames: ['cluster_id'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('restores');
    await queryRunner.dropTable('backups');
    await queryRunner.dropTable('backup_policies');
  }
}
