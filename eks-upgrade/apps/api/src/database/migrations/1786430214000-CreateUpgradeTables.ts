import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUpgradeTables1786430214000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create upgrade_jobs table
    await queryRunner.query(`
      CREATE TABLE upgrade_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cluster_id UUID NOT NULL REFERENCES clusters(id),
        node_group_id UUID,
        job_type VARCHAR NOT NULL,
        from_version VARCHAR NOT NULL,
        to_version VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        aws_update_id VARCHAR,
        initiated_by UUID NOT NULL REFERENCES users(id),
        campaign_id UUID,
        backup_id UUID,
        dry_run_id UUID,
        error_detail JSONB,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT upgrade_jobs_job_type_check CHECK (job_type IN ('control_plane', 'node_group')),
        CONSTRAINT upgrade_jobs_status_check CHECK (status IN ('pending', 'validating', 'backing_up', 'in_progress', 'succeeded', 'failed', 'cancelled'))
      )
    `);

    // Data classification comments for upgrade_jobs
    await queryRunner.query(`
      COMMENT ON COLUMN upgrade_jobs.id IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.cluster_id IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.node_group_id IS 'Internal - FK to node_groups.id (created in future WO)';
      COMMENT ON COLUMN upgrade_jobs.job_type IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.from_version IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.to_version IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.status IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.aws_update_id IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.initiated_by IS 'Confidential';
      COMMENT ON COLUMN upgrade_jobs.campaign_id IS 'Internal - FK to campaigns.id (created in future WO)';
      COMMENT ON COLUMN upgrade_jobs.backup_id IS 'Internal - FK to backups.id (created in future WO)';
      COMMENT ON COLUMN upgrade_jobs.dry_run_id IS 'Internal - FK to dry_runs.id (created in future WO)';
      COMMENT ON COLUMN upgrade_jobs.error_detail IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.started_at IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.completed_at IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.created_at IS 'Internal';
      COMMENT ON COLUMN upgrade_jobs.updated_at IS 'Internal'
    `);

    // Create indexes on upgrade_jobs
    await queryRunner.query(`
      CREATE INDEX idx_upgrade_jobs_cluster_status ON upgrade_jobs(cluster_id, status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_upgrade_jobs_initiated_by ON upgrade_jobs(initiated_by)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_upgrade_jobs_status_created ON upgrade_jobs(status, created_at)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_upgrade_jobs_aws_update_id ON upgrade_jobs(aws_update_id) WHERE aws_update_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_upgrade_jobs_campaign_id ON upgrade_jobs(campaign_id) WHERE campaign_id IS NOT NULL
    `);

    // Create upgrade_events partitioned table
    await queryRunner.query(`
      CREATE TABLE upgrade_events (
        id UUID DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL,
        event_type VARCHAR NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at)
    `);

    // Data classification comments for upgrade_events
    await queryRunner.query(`
      COMMENT ON COLUMN upgrade_events.id IS 'Internal';
      COMMENT ON COLUMN upgrade_events.job_id IS 'Internal';
      COMMENT ON COLUMN upgrade_events.event_type IS 'Internal';
      COMMENT ON COLUMN upgrade_events.message IS 'Internal';
      COMMENT ON COLUMN upgrade_events.details IS 'Internal';
      COMMENT ON COLUMN upgrade_events.occurred_at IS 'Internal'
    `);

    // Create partition helper function for upgrade_events
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_upgrade_events_partition(p_year INTEGER, p_month INTEGER)
      RETURNS void AS $$
      DECLARE
        partition_name TEXT;
        start_date DATE;
        end_date DATE;
      BEGIN
        partition_name := format('upgrade_events_%s_%s', p_year, lpad(p_month::TEXT, 2, '0'));
        start_date := make_date(p_year, p_month, 1);
        
        IF p_month = 12 THEN
          end_date := make_date(p_year + 1, 1, 1);
        ELSE
          end_date := make_date(p_year, p_month + 1, 1);
        END IF;

        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS %I PARTITION OF upgrade_events FOR VALUES FROM (%L) TO (%L)',
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
    const currentMonth = currentDate.getMonth() + 1;

    for (let i = 0; i < 4; i++) {
      let year = currentYear;
      let month = currentMonth + i;

      while (month > 12) {
        month -= 12;
        year += 1;
      }

      await queryRunner.query(
        `SELECT create_upgrade_events_partition($1, $2)`,
        [year, month],
      );
    }

    // Create indexes on upgrade_events
    await queryRunner.query(`
      CREATE INDEX idx_upgrade_events_job_time ON upgrade_events(job_id, occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_upgrade_events_details ON upgrade_events USING GIN (details)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop upgrade_events partitions
    const partitions = await queryRunner.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'upgrade_events_%'
    `);

    for (const partition of partitions) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${partition.tablename} CASCADE`);
    }

    // Drop partition helper function
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_upgrade_events_partition(INTEGER, INTEGER)`);

    // Drop upgrade_events parent table
    await queryRunner.query(`DROP TABLE IF EXISTS upgrade_events CASCADE`);

    // Drop upgrade_jobs table
    await queryRunner.query(`DROP TABLE IF EXISTS upgrade_jobs CASCADE`);
  }
}
