import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClusterTables1786430122000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create cluster_accounts table
    await queryRunner.query(`
      CREATE TABLE cluster_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        aws_account_id VARCHAR NOT NULL UNIQUE,
        role_arn VARCHAR NOT NULL,
        external_id VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        last_assumed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT cluster_accounts_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
      )
    `);

    // Data classification comments for cluster_accounts
    await queryRunner.query(`
      COMMENT ON COLUMN cluster_accounts.id IS 'Internal';
      COMMENT ON COLUMN cluster_accounts.aws_account_id IS 'Confidential';
      COMMENT ON COLUMN cluster_accounts.role_arn IS 'Confidential - Application-level encrypted';
      COMMENT ON COLUMN cluster_accounts.external_id IS 'Confidential - Application-level encrypted';
      COMMENT ON COLUMN cluster_accounts.status IS 'Internal';
      COMMENT ON COLUMN cluster_accounts.last_assumed_at IS 'Internal';
      COMMENT ON COLUMN cluster_accounts.created_at IS 'Internal';
      COMMENT ON COLUMN cluster_accounts.updated_at IS 'Internal'
    `);

    // Create clusters table
    await queryRunner.query(`
      CREATE TABLE clusters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        account_id UUID NOT NULL,
        region VARCHAR NOT NULL,
        current_version VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'discovered',
        environment_tag VARCHAR NOT NULL,
        discovery_metadata JSONB,
        last_discovered_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT clusters_account_fk FOREIGN KEY (account_id) REFERENCES cluster_accounts(id) ON DELETE RESTRICT,
        CONSTRAINT clusters_status_check CHECK (status IN ('discovered', 'healthy', 'unhealthy', 'upgrading', 'upgrade_failed', 'decommissioned')),
        CONSTRAINT clusters_environment_check CHECK (environment_tag IN ('production', 'staging', 'development', 'sandbox')),
        CONSTRAINT clusters_name_account_unique UNIQUE (name, account_id)
      )
    `);

    // Data classification comments for clusters
    await queryRunner.query(`
      COMMENT ON COLUMN clusters.id IS 'Internal';
      COMMENT ON COLUMN clusters.name IS 'Internal';
      COMMENT ON COLUMN clusters.account_id IS 'Internal';
      COMMENT ON COLUMN clusters.region IS 'Internal';
      COMMENT ON COLUMN clusters.current_version IS 'Internal';
      COMMENT ON COLUMN clusters.status IS 'Internal';
      COMMENT ON COLUMN clusters.environment_tag IS 'Internal';
      COMMENT ON COLUMN clusters.discovery_metadata IS 'Internal - May contain Restricted sub-fields';
      COMMENT ON COLUMN clusters.last_discovered_at IS 'Internal';
      COMMENT ON COLUMN clusters.created_at IS 'Internal';
      COMMENT ON COLUMN clusters.updated_at IS 'Internal'
    `);

    // Create indexes for clusters table
    await queryRunner.query(`
      CREATE INDEX idx_clusters_account ON clusters(account_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clusters_region ON clusters(region)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clusters_status ON clusters(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clusters_environment ON clusters(environment_tag)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clusters_version ON clusters(current_version)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_clusters_account_region ON clusters(account_id, region)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop clusters table first (has FK to cluster_accounts)
    await queryRunner.query(`DROP TABLE IF EXISTS clusters CASCADE`);

    // Drop cluster_accounts table
    await queryRunner.query(`DROP TABLE IF EXISTS cluster_accounts CASCADE`);
  }
}
