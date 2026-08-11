import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateNodeGroupTables1786430300000 implements MigrationInterface {
  name = 'CreateNodeGroupTables1786430300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'node_groups',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'cluster_id', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '128', isNullable: false },
          { name: 'node_group_name', type: 'varchar', length: '255', isNullable: false, comment: 'AWS node group name' },
          { name: 'ami_type', type: 'varchar', length: '64', isNullable: true },
          { name: 'instance_types', type: 'jsonb', default: "'[]'", comment: 'Array of EC2 instance types' },
          { name: 'current_version', type: 'varchar', length: '16', isNullable: false },
          { name: 'target_version', type: 'varchar', length: '16', isNullable: true },
          { name: 'min_size', type: 'integer', default: 1 },
          { name: 'max_size', type: 'integer', default: 10 },
          { name: 'desired_size', type: 'integer', default: 1 },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'ACTIVE'",
            comment: 'ACTIVE | UPDATING | DEGRADED | DELETING',
          },
          { name: 'labels', type: 'jsonb', default: "'{}'", comment: 'Kubernetes node labels' },
          { name: 'taints', type: 'jsonb', default: "'[]'", comment: 'Kubernetes node taints' },
          { name: 'tags', type: 'jsonb', default: "'{}'", comment: 'AWS resource tags' },
          { name: 'launch_template_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'launch_template_version', type: 'varchar', length: '16', isNullable: true },
          { name: 'disk_size_gb', type: 'integer', isNullable: true },
          { name: 'subnets', type: 'jsonb', default: "'[]'", comment: 'Array of subnet IDs' },
          { name: 'capacity_type', type: 'varchar', length: '16', default: "'ON_DEMAND'" },
          { name: 'upgrade_order', type: 'integer', isNullable: true, comment: 'Sequence for ordered upgrades' },
          { name: 'upgrade_strategy', type: 'varchar', length: '32', default: "'ROLLING'", comment: 'ROLLING | BLUE_GREEN' },
          { name: 'max_unavailable', type: 'integer', isNullable: true },
          { name: 'max_unavailable_percentage', type: 'integer', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'last_synced_at', type: 'timestamptz', isNullable: true },
        ],
        uniques: [
          { columnNames: ['cluster_id', 'name'] },
          { columnNames: ['cluster_id', 'node_group_name'] },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'node_group_upgrade_steps',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'upgrade_job_id', type: 'uuid', isNullable: false },
          { name: 'node_group_id', type: 'uuid', isNullable: false },
          { name: 'node_group_name', type: 'varchar', length: '255', isNullable: false },
          { name: 'step_order', type: 'integer', isNullable: false },
          { name: 'from_version', type: 'varchar', length: '16', isNullable: false },
          { name: 'to_version', type: 'varchar', length: '16', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'PENDING'",
            comment: 'PENDING | IN_PROGRESS | COMPLETED | FAILED | SKIPPED',
          },
          { name: 'started_at', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'aws_update_id', type: 'varchar', length: '128', isNullable: true, comment: 'EKS node group update ID' },
          { name: 'nodes_updated', type: 'integer', default: 0 },
          { name: 'nodes_total', type: 'integer', default: 0 },
          { name: 'metadata', type: 'jsonb', default: "'{}'", comment: 'Additional context' },
          { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
          { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'node_groups',
      new TableIndex({ name: 'idx_node_groups_cluster_id', columnNames: ['cluster_id'] }),
    );
    await queryRunner.createIndex(
      'node_groups',
      new TableIndex({ name: 'idx_node_groups_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'node_group_upgrade_steps',
      new TableIndex({ name: 'idx_ng_steps_upgrade_job_id', columnNames: ['upgrade_job_id'] }),
    );
    await queryRunner.createIndex(
      'node_group_upgrade_steps',
      new TableIndex({ name: 'idx_ng_steps_status', columnNames: ['status'] }),
    );

    await queryRunner.createForeignKey(
      'node_groups',
      new TableForeignKey({
        name: 'fk_node_groups_cluster',
        columnNames: ['cluster_id'],
        referencedTableName: 'clusters',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'node_group_upgrade_steps',
      new TableForeignKey({
        name: 'fk_ng_steps_upgrade_job',
        columnNames: ['upgrade_job_id'],
        referencedTableName: 'upgrade_jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'node_group_upgrade_steps',
      new TableForeignKey({
        name: 'fk_ng_steps_node_group',
        columnNames: ['node_group_id'],
        referencedTableName: 'node_groups',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // auto-update trigger for updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_node_groups_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER node_groups_updated_at
        BEFORE UPDATE ON node_groups
        FOR EACH ROW EXECUTE FUNCTION update_node_groups_updated_at();

      CREATE TRIGGER ng_steps_updated_at
        BEFORE UPDATE ON node_group_upgrade_steps
        FOR EACH ROW EXECUTE FUNCTION update_node_groups_updated_at();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS ng_steps_updated_at ON node_group_upgrade_steps');
    await queryRunner.query('DROP TRIGGER IF EXISTS node_groups_updated_at ON node_groups');
    await queryRunner.query('DROP FUNCTION IF EXISTS update_node_groups_updated_at()');
    await queryRunner.dropForeignKey('node_group_upgrade_steps', 'fk_ng_steps_node_group');
    await queryRunner.dropForeignKey('node_group_upgrade_steps', 'fk_ng_steps_upgrade_job');
    await queryRunner.dropForeignKey('node_groups', 'fk_node_groups_cluster');
    await queryRunner.dropTable('node_group_upgrade_steps');
    await queryRunner.dropTable('node_groups');
  }
}
