import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCampaignTables1786430400000 implements MigrationInterface {
  name = 'CreateCampaignTables1786430400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'campaigns',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'target_version', type: 'varchar', length: '16', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'DRAFT'",
            comment: 'DRAFT | RUNNING | PAUSED | COMPLETED | FAILED | CANCELLED',
          },
          { name: 'dry_run', type: 'boolean', default: false },
          { name: 'schedule_cron', type: 'varchar', length: '64', isNullable: true },
          { name: 'scheduled_at', type: 'timestamptz', isNullable: true },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'max_parallel', type: 'integer', default: 1 },
          { name: 'created_by', type: 'uuid', isNullable: false },
          { name: 'metadata', type: 'jsonb', default: "'{}'"},
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'campaign_targets',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'campaign_id', type: 'uuid', isNullable: false },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'PENDING'",
            comment: 'PENDING | RUNNING | COMPLETED | FAILED | SKIPPED | INELIGIBLE',
          },
          { name: 'upgrade_job_id', type: 'uuid', isNullable: true },
          { name: 'eligibility_checked_at', type: 'timestamptz', isNullable: true },
          { name: 'eligibility_pass', type: 'boolean', isNullable: true },
          { name: 'eligibility_reasons', type: 'jsonb', default: "'[]'" },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'sort_order', type: 'integer', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
        uniques: [{ columnNames: ['campaign_id', 'cluster_id'] }],
      }),
      true,
    );

    await queryRunner.createIndex('campaigns', new TableIndex({ name: 'idx_campaigns_status', columnNames: ['status'] }));
    await queryRunner.createIndex('campaigns', new TableIndex({ name: 'idx_campaigns_created_by', columnNames: ['created_by'] }));
    await queryRunner.createIndex('campaign_targets', new TableIndex({ name: 'idx_campaign_targets_campaign_id', columnNames: ['campaign_id'] }));
    await queryRunner.createIndex('campaign_targets', new TableIndex({ name: 'idx_campaign_targets_cluster_id', columnNames: ['cluster_id'] }));
    await queryRunner.createIndex('campaign_targets', new TableIndex({ name: 'idx_campaign_targets_status', columnNames: ['status'] }));

    await queryRunner.createForeignKey(
      'campaign_targets',
      new TableForeignKey({
        name: 'fk_campaign_targets_campaign',
        columnNames: ['campaign_id'],
        referencedTableName: 'campaigns',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'campaign_targets',
      new TableForeignKey({
        name: 'fk_campaign_targets_cluster',
        columnNames: ['cluster_id'],
        referencedTableName: 'clusters',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('campaign_targets', 'fk_campaign_targets_cluster');
    await queryRunner.dropForeignKey('campaign_targets', 'fk_campaign_targets_campaign');
    await queryRunner.dropTable('campaign_targets');
    await queryRunner.dropTable('campaigns');
  }
}
