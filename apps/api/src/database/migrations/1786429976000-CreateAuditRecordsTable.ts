import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditRecordsTable1786429976000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create parent partitioned table
    await queryRunner.query(`
      CREATE TABLE audit_records (
        id UUID DEFAULT gen_random_uuid(),
        actor_id VARCHAR NOT NULL,
        actor_role VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        resource_type VARCHAR NOT NULL,
        resource_id VARCHAR NOT NULL,
        change_detail JSONB,
        approval_chain JSONB,
        request_id VARCHAR,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at)
    `);

    // Data classification comments
    await queryRunner.query(`
      COMMENT ON COLUMN audit_records.id IS 'Internal';
      COMMENT ON COLUMN audit_records.actor_id IS 'Confidential';
      COMMENT ON COLUMN audit_records.actor_role IS 'Internal';
      COMMENT ON COLUMN audit_records.action IS 'Internal';
      COMMENT ON COLUMN audit_records.resource_type IS 'Internal';
      COMMENT ON COLUMN audit_records.resource_id IS 'Internal';
      COMMENT ON COLUMN audit_records.change_detail IS 'Confidential';
      COMMENT ON COLUMN audit_records.approval_chain IS 'Confidential';
      COMMENT ON COLUMN audit_records.request_id IS 'Internal';
      COMMENT ON COLUMN audit_records.occurred_at IS 'Internal'
    `);

    // Create immutability trigger function for UPDATE
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_records_prevent_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit records are immutable and cannot be updated';
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create immutability trigger function for DELETE
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_records_prevent_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit records are immutable and cannot be deleted';
      END;
      $$ LANGUAGE plpgsql
    `);

    // Attach triggers to parent table
    await queryRunner.query(`
      CREATE TRIGGER audit_records_immutable_update
      BEFORE UPDATE ON audit_records
      FOR EACH ROW
      EXECUTE FUNCTION audit_records_prevent_update()
    `);

    await queryRunner.query(`
      CREATE TRIGGER audit_records_immutable_delete
      BEFORE DELETE ON audit_records
      FOR EACH ROW
      EXECUTE FUNCTION audit_records_prevent_delete()
    `);

    // Create partition helper function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_audit_partition(p_year INTEGER, p_month INTEGER)
      RETURNS void AS $$
      DECLARE
        partition_name TEXT;
        start_date DATE;
        end_date DATE;
      BEGIN
        partition_name := format('audit_records_%s_%s', p_year, lpad(p_month::TEXT, 2, '0'));
        start_date := make_date(p_year, p_month, 1);
        
        IF p_month = 12 THEN
          end_date := make_date(p_year + 1, 1, 1);
        ELSE
          end_date := make_date(p_year, p_month + 1, 1);
        END IF;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_records FOR VALUES FROM (%L) TO (%L)',
          partition_name,
          start_date,
          end_date
        );
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create partitions for current month + 3 months ahead
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JS months are 0-indexed

    for (let i = 0; i < 4; i++) {
      let year = currentYear;
      let month = currentMonth + i;

      // Handle year rollover
      while (month > 12) {
        month -= 12;
        year += 1;
      }

      await queryRunner.query(
        `SELECT create_audit_partition($1, $2)`,
        [year, month],
      );
    }

    // Create indexes on parent table (will be inherited by partitions)
    await queryRunner.query(`
      CREATE INDEX idx_audit_actor_time ON audit_records (actor_id, occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_resource_time ON audit_records (resource_type, resource_id, occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_change_detail ON audit_records USING GIN (change_detail)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all child partitions
    const partitions = await queryRunner.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'audit_records_%'
    `);

    for (const partition of partitions) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${partition.tablename} CASCADE`);
    }

    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS audit_records_immutable_delete ON audit_records`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS audit_records_immutable_update ON audit_records`);

    // Drop trigger functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_records_prevent_delete()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_records_prevent_update()`);

    // Drop partition helper function
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_audit_partition(INTEGER, INTEGER)`);

    // Drop parent table
    await queryRunner.query(`DROP TABLE IF EXISTS audit_records CASCADE`);
  }
}
