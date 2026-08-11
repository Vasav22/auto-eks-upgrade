import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateHealthCheckTables1786430500000 implements MigrationInterface {
  name = 'CreateHealthCheckTables1786430500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'health_checks',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'upgrade_job_id', type: 'uuid', isNullable: true },
          { name: 'trigger', type: 'varchar', length: '32', default: "'MANUAL'", comment: 'MANUAL | POST_UPGRADE | SCHEDULED' },
          { name: 'status', type: 'varchar', length: '32', default: "'RUNNING'", comment: 'RUNNING | COMPLETED | FAILED' },
          { name: 'overall_health', type: 'varchar', length: '32', isNullable: true, comment: 'HEALTHY | WARNING | CRITICAL' },
          { name: 'total_findings', type: 'integer', default: 0 },
          { name: 'critical_count', type: 'integer', default: 0 },
          { name: 'high_count', type: 'integer', default: 0 },
          { name: 'warning_count', type: 'integer', default: 0 },
          { name: 'findings', type: 'jsonb', default: "'[]'" },
          { name: 'node_summary', type: 'jsonb', isNullable: true },
          { name: 'pod_summary', type: 'jsonb', isNullable: true },
          { name: 'pdb_summary', type: 'jsonb', isNullable: true },
          { name: 'agent_endpoint', type: 'varchar', length: '255', isNullable: true },
          { name: 'started_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('health_checks', new TableIndex({ name: 'idx_health_checks_cluster_id', columnNames: ['cluster_id'] }));
    await queryRunner.createIndex('health_checks', new TableIndex({ name: 'idx_health_checks_upgrade_job_id', columnNames: ['upgrade_job_id'] }));
    await queryRunner.createIndex('health_checks', new TableIndex({ name: 'idx_health_checks_status', columnNames: ['status'] }));
    await queryRunner.createIndex('health_checks', new TableIndex({ name: 'idx_health_checks_trigger', columnNames: ['trigger'] }));

    await queryRunner.createForeignKey(
      'health_checks',
      new TableForeignKey({
        name: 'fk_health_checks_cluster',
        columnNames: ['cluster_id'],
        referencedTableName: 'clusters',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('health_checks', 'fk_health_checks_cluster');
    await queryRunner.dropTable('health_checks');
  }
}
