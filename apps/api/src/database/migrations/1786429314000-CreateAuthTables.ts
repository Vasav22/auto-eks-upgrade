import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1786429314000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create roles table
    await queryRunner.query(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT roles_name_check CHECK (name IN ('upgrade_operator', 'sre_oncall', 'cluster_admin', 'change_coordinator', 'compliance_reviewer'))
      )
    `);

    // Data classification comments for roles table
    await queryRunner.query(`
      COMMENT ON COLUMN roles.id IS 'Internal';
      COMMENT ON COLUMN roles.name IS 'Internal';
      COMMENT ON COLUMN roles.description IS 'Internal';
      COMMENT ON COLUMN roles.created_at IS 'Internal'
    `);

    // Seed roles
    await queryRunner.query(`
      INSERT INTO roles (name, description) VALUES
        ('upgrade_operator', 'Can initiate and manage upgrades in dev and staging environments'),
        ('sre_oncall', 'Can perform emergency operations including health checks and remediation in all environments'),
        ('cluster_admin', 'Full administrative access to all cluster operations in all environments'),
        ('change_coordinator', 'Can approve and coordinate changes across all environments'),
        ('compliance_reviewer', 'Read-only access for audit and compliance purposes')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        oidc_subject VARCHAR NOT NULL UNIQUE,
        email VARCHAR NOT NULL,
        display_name VARCHAR NOT NULL,
        role VARCHAR NOT NULL REFERENCES roles(name) ON UPDATE CASCADE,
        status VARCHAR NOT NULL DEFAULT 'active',
        last_login_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Data classification comments for users table
    await queryRunner.query(`
      COMMENT ON COLUMN users.id IS 'Internal';
      COMMENT ON COLUMN users.oidc_subject IS 'Confidential';
      COMMENT ON COLUMN users.email IS 'Confidential';
      COMMENT ON COLUMN users.display_name IS 'Internal';
      COMMENT ON COLUMN users.role IS 'Internal';
      COMMENT ON COLUMN users.status IS 'Internal';
      COMMENT ON COLUMN users.last_login_at IS 'Internal';
      COMMENT ON COLUMN users.created_at IS 'Internal';
      COMMENT ON COLUMN users.updated_at IS 'Internal'
    `);

    // Create index on users
    await queryRunner.query(`CREATE INDEX idx_users_email ON users(email)`);

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        resource_type VARCHAR NOT NULL,
        action VARCHAR NOT NULL,
        environment_scope VARCHAR NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_permission_role_resource_action_env UNIQUE (role_id, resource_type, action, environment_scope)
      )
    `);

    // Data classification comments for permissions table
    await queryRunner.query(`
      COMMENT ON COLUMN permissions.id IS 'Internal';
      COMMENT ON COLUMN permissions.role_id IS 'Internal';
      COMMENT ON COLUMN permissions.resource_type IS 'Internal';
      COMMENT ON COLUMN permissions.action IS 'Internal';
      COMMENT ON COLUMN permissions.environment_scope IS 'Internal';
      COMMENT ON COLUMN permissions.created_at IS 'Internal'
    `);

    // Create index on permissions
    await queryRunner.query(`CREATE INDEX idx_permissions_role_resource ON permissions(role_id, resource_type)`);

    // Seed permissions for all 5 roles
    await queryRunner.query(`
      INSERT INTO permissions (role_id, resource_type, action, environment_scope)
      SELECT r.id, p.resource_type, p.action, p.environment_scope
      FROM roles r
      CROSS JOIN (VALUES
        -- upgrade_operator permissions
        ('upgrade_operator', 'cluster', 'read', '*'),
        ('upgrade_operator', 'cluster', 'upgrade', 'dev'),
        ('upgrade_operator', 'cluster', 'upgrade', 'staging'),
        ('upgrade_operator', 'upgrade_job', 'create', 'dev'),
        ('upgrade_operator', 'upgrade_job', 'create', 'staging'),
        ('upgrade_operator', 'upgrade_job', 'read', '*'),
        ('upgrade_operator', 'health', 'read', '*'),
        
        -- sre_oncall permissions
        ('sre_oncall', 'cluster', 'read', '*'),
        ('sre_oncall', 'health', 'read', '*'),
        ('sre_oncall', 'health', 'check', '*'),
        ('sre_oncall', 'remediation', 'execute', '*'),
        ('sre_oncall', 'backup', 'restore', '*'),
        ('sre_oncall', 'upgrade_job', 'read', '*'),
        ('sre_oncall', 'upgrade_job', 'pause', '*'),
        ('sre_oncall', 'upgrade_job', 'rollback', '*'),
        
        -- cluster_admin permissions
        ('cluster_admin', 'cluster', '*', '*'),
        ('cluster_admin', 'upgrade_job', '*', '*'),
        ('cluster_admin', 'health', '*', '*'),
        ('cluster_admin', 'remediation', '*', '*'),
        ('cluster_admin', 'backup', '*', '*'),
        ('cluster_admin', 'user', '*', '*'),
        ('cluster_admin', 'role', '*', '*'),
        ('cluster_admin', 'permission', '*', '*'),
        
        -- change_coordinator permissions
        ('change_coordinator', 'cluster', 'read', '*'),
        ('change_coordinator', 'upgrade_job', 'read', '*'),
        ('change_coordinator', 'upgrade_job', 'approve', '*'),
        ('change_coordinator', 'upgrade_job', 'schedule', '*'),
        ('change_coordinator', 'campaign', '*', '*'),
        ('change_coordinator', 'backup', 'read', '*'),
        ('change_coordinator', 'audit', 'read', '*'),
        
        -- compliance_reviewer permissions
        ('compliance_reviewer', 'cluster', 'read', '*'),
        ('compliance_reviewer', 'upgrade_job', 'read', '*'),
        ('compliance_reviewer', 'health', 'read', '*'),
        ('compliance_reviewer', 'backup', 'read', '*'),
        ('compliance_reviewer', 'audit', 'read', '*'),
        ('compliance_reviewer', 'user', 'read', '*'),
        ('compliance_reviewer', 'role', 'read', '*'),
        ('compliance_reviewer', 'permission', 'read', '*')
      ) AS p(role_name, resource_type, action, environment_scope)
      WHERE r.name = p.role_name
    `);

    // Create sessions table
    await queryRunner.query(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR NOT NULL,
        ip_address INET,
        user_agent TEXT,
        idle_timeout_at TIMESTAMP NOT NULL,
        absolute_timeout_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        revoked_at TIMESTAMP
      )
    `);

    // Data classification comments for sessions table
    await queryRunner.query(`
      COMMENT ON COLUMN sessions.id IS 'Internal';
      COMMENT ON COLUMN sessions.user_id IS 'Confidential';
      COMMENT ON COLUMN sessions.refresh_token_hash IS 'Confidential';
      COMMENT ON COLUMN sessions.ip_address IS 'Confidential';
      COMMENT ON COLUMN sessions.user_agent IS 'Internal';
      COMMENT ON COLUMN sessions.idle_timeout_at IS 'Internal';
      COMMENT ON COLUMN sessions.absolute_timeout_at IS 'Internal';
      COMMENT ON COLUMN sessions.created_at IS 'Internal';
      COMMENT ON COLUMN sessions.revoked_at IS 'Internal'
    `);

    // Create indexes on sessions
    await queryRunner.query(`CREATE INDEX idx_sessions_user_revoked ON sessions(user_id, revoked_at)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_idle_timeout ON sessions(idle_timeout_at)`);

    // Create RLS helper function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_rls_context(p_role TEXT, p_user_id TEXT)
      RETURNS void AS $$
      BEGIN
        PERFORM set_config('app.current_role', p_role, true);
        PERFORM set_config('app.current_user_id', p_user_id, true);
      END;
      $$ LANGUAGE plpgsql
    `);

    // Enable RLS on users, sessions, and permissions
    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE permissions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE permissions FORCE ROW LEVEL SECURITY`);

    // RLS policy for compliance_reviewer: SELECT only
    await queryRunner.query(`
      CREATE POLICY compliance_reviewer_select_users ON users
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'compliance_reviewer')
    `);

    await queryRunner.query(`
      CREATE POLICY compliance_reviewer_select_sessions ON sessions
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'compliance_reviewer')
    `);

    await queryRunner.query(`
      CREATE POLICY compliance_reviewer_select_permissions ON permissions
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'compliance_reviewer')
    `);

    // RLS policy for cluster_admin and change_coordinator: full access
    await queryRunner.query(`
      CREATE POLICY admin_all_users ON users
      FOR ALL
      USING (current_setting('app.current_role', true) IN ('cluster_admin', 'change_coordinator'))
    `);

    await queryRunner.query(`
      CREATE POLICY admin_all_sessions ON sessions
      FOR ALL
      USING (current_setting('app.current_role', true) IN ('cluster_admin', 'change_coordinator'))
    `);

    await queryRunner.query(`
      CREATE POLICY admin_all_permissions ON permissions
      FOR ALL
      USING (current_setting('app.current_role', true) IN ('cluster_admin', 'change_coordinator'))
    `);

    // RLS policy for upgrade_operator: read all, no production writes
    await queryRunner.query(`
      CREATE POLICY operator_select_users ON users
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'upgrade_operator')
    `);

    await queryRunner.query(`
      CREATE POLICY operator_select_sessions ON sessions
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'upgrade_operator')
    `);

    await queryRunner.query(`
      CREATE POLICY operator_select_permissions ON permissions
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'upgrade_operator')
    `);

    // RLS policy for sre_oncall: read all, limited write
    await queryRunner.query(`
      CREATE POLICY sre_select_users ON users
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'sre_oncall')
    `);

    await queryRunner.query(`
      CREATE POLICY sre_select_sessions ON sessions
      FOR SELECT
      USING (current_setting('app.current_role', true) = 'sre_oncall')
    `);

    await queryRunner.query(`
      CREATE POLICY sre_insert_sessions ON sessions
      FOR INSERT
      WITH CHECK (current_setting('app.current_role', true) = 'sre_oncall')
    `);

    await queryRunner.query(`
      CREATE POLICY sre_update_sessions ON sessions
      FOR UPDATE
      USING (current_setting('app.current_role', true) = 'sre_oncall')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop RLS policies
    await queryRunner.query(`DROP POLICY IF EXISTS sre_update_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS sre_insert_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS sre_select_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS sre_select_users ON users`);
    await queryRunner.query(`DROP POLICY IF EXISTS operator_select_permissions ON permissions`);
    await queryRunner.query(`DROP POLICY IF EXISTS operator_select_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS operator_select_users ON users`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_all_permissions ON permissions`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_all_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS admin_all_users ON users`);
    await queryRunner.query(`DROP POLICY IF EXISTS compliance_reviewer_select_permissions ON permissions`);
    await queryRunner.query(`DROP POLICY IF EXISTS compliance_reviewer_select_sessions ON sessions`);
    await queryRunner.query(`DROP POLICY IF EXISTS compliance_reviewer_select_users ON users`);

    // Disable RLS
    await queryRunner.query(`ALTER TABLE permissions DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE sessions DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);

    // Drop RLS helper function
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_rls_context(TEXT, TEXT)`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS sessions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles CASCADE`);
  }
}
