import { DataSource } from 'typeorm';
import { CreateAuthTables1786429314000 } from './1786429314000-CreateAuthTables';
import {
  ROLE_NAMES,
  EXPECTED_PERMISSION_COUNTS,
} from '../../../../../test/fixtures/auth-fixtures';

describe('CreateAuthTables Migration', () => {
  let dataSource: DataSource;
  let migration: CreateAuthTables1786429314000;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env['DATABASE_HOST'] || 'localhost',
      port: parseInt(process.env['DATABASE_PORT'] || '5433', 10),
      username: process.env['DATABASE_USER'] || 'postgres',
      password: process.env['DATABASE_PASSWORD'] || 'postgres',
      database: process.env['DATABASE_NAME'] || 'eks_upgrade_test',
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    migration = new CreateAuthTables1786429314000();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  afterEach(async () => {
    await migration.down(dataSource.createQueryRunner());
  });

  it('should create all four tables', async () => {
    await migration.up(dataSource.createQueryRunner());

    const tables = await dataSource.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('roles', 'users', 'permissions', 'sessions')
    `);

    expect(tables).toHaveLength(4);
    expect(tables.map((t: any) => t.table_name)).toEqual(
      expect.arrayContaining(['roles', 'users', 'permissions', 'sessions']),
    );
  });

  it('should seed all 5 roles', async () => {
    await migration.up(dataSource.createQueryRunner());

    const roles = await dataSource.query(`SELECT name FROM roles ORDER BY name`);

    expect(roles).toHaveLength(5);
    expect(roles.map((r: any) => r.name)).toEqual([...ROLE_NAMES].sort());
  });

  it('should seed correct permission counts for each role', async () => {
    await migration.up(dataSource.createQueryRunner());

    for (const roleName of ROLE_NAMES) {
      const result = await dataSource.query(
        `
        SELECT COUNT(*) as count
        FROM permissions p
        JOIN roles r ON p.role_id = r.id
        WHERE r.name = $1
      `,
        [roleName],
      );

      expect(parseInt(result[0].count, 10)).toBe(
        EXPECTED_PERMISSION_COUNTS[roleName],
      );
    }
  });

  it('should enable RLS on users, sessions, and permissions tables', async () => {
    await migration.up(dataSource.createQueryRunner());

    const rlsEnabled = await dataSource.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'sessions', 'permissions')
    `);

    expect(rlsEnabled).toHaveLength(3);
    rlsEnabled.forEach((row: any) => {
      expect(row.rowsecurity).toBe(true);
    });
  });

  it('should create set_rls_context function', async () => {
    await migration.up(dataSource.createQueryRunner());

    const functions = await dataSource.query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'set_rls_context'
    `);

    expect(functions).toHaveLength(1);
  });

  it('should create correct indexes', async () => {
    await migration.up(dataSource.createQueryRunner());

    const indexes = await dataSource.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname IN ('idx_users_email', 'idx_sessions_user_revoked', 'idx_sessions_idle_timeout', 'idx_permissions_role_resource')
    `);

    expect(indexes).toHaveLength(4);
  });

  it('should apply data classification comments', async () => {
    await migration.up(dataSource.createQueryRunner());

    const comments = await dataSource.query(`
      SELECT
        c.table_name,
        c.column_name,
        pgd.description
      FROM information_schema.columns c
      JOIN pg_class pgc ON pgc.relname = c.table_name
      JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace
      JOIN pg_description pgd ON pgd.objoid = pgc.oid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_schema = 'public'
      AND c.table_name IN ('users', 'roles', 'permissions', 'sessions')
      AND pgd.description IN ('Public', 'Internal', 'Confidential', 'Restricted')
    `);

    expect(comments.length).toBeGreaterThan(0);
  });

  it('should rollback cleanly', async () => {
    await migration.up(dataSource.createQueryRunner());
    await migration.down(dataSource.createQueryRunner());

    const tables = await dataSource.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('roles', 'users', 'permissions', 'sessions')
    `);

    expect(tables).toHaveLength(0);

    const functions = await dataSource.query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'set_rls_context'
    `);

    expect(functions).toHaveLength(0);
  });
});
