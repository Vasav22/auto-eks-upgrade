import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateRemediationTables1786430600000 implements MigrationInterface {
  name = 'CreateRemediationTables1786430600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'remediation_proposals',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'health_check_id', type: 'uuid', isNullable: false },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'finding_category', type: 'varchar', length: '64' },
          { name: 'finding_title', type: 'varchar', length: '255' },
          { name: 'severity', type: 'varchar', length: '16' },
          { name: 'proposed_action', type: 'varchar', length: '64' },
          { name: 'description', type: 'text' },
          { name: 'risk_level', type: 'varchar', length: '16', default: "'LOW'" },
          { name: 'requires_approval', type: 'boolean', default: true },
          { name: 'auto_approved', type: 'boolean', default: false },
          { name: 'status', type: 'varchar', length: '32', default: "'PENDING'", comment: 'PENDING | APPROVED | REJECTED | EXECUTING | COMPLETED | FAILED' },
          { name: 'approver_ids', type: 'jsonb', default: "'[]'" },
          { name: 'approved_at', type: 'timestamptz', isNullable: true },
          { name: 'rejected_at', type: 'timestamptz', isNullable: true },
          { name: 'rejection_reason', type: 'text', isNullable: true },
          { name: 'executed_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'execution_output', type: 'jsonb', default: "'{}'"},
          { name: 'idempotency_key', type: 'varchar', length: '128', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('remediation_proposals', new TableIndex({ name: 'idx_remediation_cluster_id', columnNames: ['cluster_id'] }));
    await queryRunner.createIndex('remediation_proposals', new TableIndex({ name: 'idx_remediation_status', columnNames: ['status'] }));
    await queryRunner.createIndex('remediation_proposals', new TableIndex({ name: 'idx_remediation_health_check', columnNames: ['health_check_id'] }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('remediation_proposals');
  }
}
