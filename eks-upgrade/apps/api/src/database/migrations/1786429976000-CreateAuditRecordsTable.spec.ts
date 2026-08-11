import { DataSource } from 'typeorm';
import { CreateAuditRecordsTable1786429976000 } from './1786429976000-CreateAuditRecordsTable';
import {
  createAuditRecord,
  createAuditRecordBatch,
} from '../../../../../test/fixtures/audit-fixtures';

describe('CreateAuditRecordsTable Migration', () => {
  let dataSource: DataSource;
  let migration: CreateAuditRecordsTable1786429976000;

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
    migration = new CreateAuditRecordsTable1786429976000();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  afterEach(async () => {
    await migration.down(dataSource.createQueryRunner());
  });

  it('should create audit_records parent table', async () => {
    await migration.up(dataSource.createQueryRunner());

    const tables = await dataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'audit_records'
    `);

    expect(tables).toHaveLength(1);
  });

  it('should create monthly partitions (current + 3 months)', async () => {
    await migration.up(dataSource.createQueryRunner());

    const partitions = await dataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'audit_records_%'
    `);

    expect(partitions.length).toBeGreaterThanOrEqual(4);
  });

  it('should create create_audit_partition helper function', async () => {
    await migration.up(dataSource.createQueryRunner());

    const functions = await dataSource.query(`
      SELECT proname FROM pg_proc
      WHERE proname = 'create_audit_partition'
    `);

    expect(functions).toHaveLength(1);
  });

  it('should allow INSERT of audit records', async () => {
    await migration.up(dataSource.createQueryRunner());

    const record = createAuditRecord();

    await expect(
      dataSource.query(
        `
        INSERT INTO audit_records (
          id, actor_id, actor_role, action, resource_type, resource_id,
          change_detail, approval_chain, request_id, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          record.id,
          record.actorId,
          record.actorRole,
          record.action,
          record.resourceType,
          record.resourceId,
          JSON.stringify(record.changeDetail),
          JSON.stringify(record.approvalChain),
          record.requestId,
          record.occurredAt,
        ],
      ),
    ).resolves.not.toThrow();
  });

  it('should prevent UPDATE of audit records', async () => {
    await migration.up(dataSource.createQueryRunner());

    const record = createAuditRecord();

    await dataSource.query(
      `
      INSERT INTO audit_records (
        id, actor_id, actor_role, action, resource_type, resource_id,
        change_detail, approval_chain, request_id, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        record.id,
        record.actorId,
        record.actorRole,
        record.action,
        record.resourceType,
        record.resourceId,
        JSON.stringify(record.changeDetail),
        JSON.stringify(record.approvalChain),
        record.requestId,
        record.occurredAt,
      ],
    );

    await expect(
      dataSource.query(
        `UPDATE audit_records SET action = 'modified' WHERE id = $1`,
        [record.id],
      ),
    ).rejects.toThrow('Audit records are immutable and cannot be updated');
  });

  it('should prevent DELETE of audit records', async () => {
    await migration.up(dataSource.createQueryRunner());

    const record = createAuditRecord();

    await dataSource.query(
      `
      INSERT INTO audit_records (
        id, actor_id, actor_role, action, resource_type, resource_id,
        change_detail, approval_chain, request_id, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        record.id,
        record.actorId,
        record.actorRole,
        record.action,
        record.resourceType,
        record.resourceId,
        JSON.stringify(record.changeDetail),
        JSON.stringify(record.approvalChain),
        record.requestId,
        record.occurredAt,
      ],
    );

    await expect(
      dataSource.query(`DELETE FROM audit_records WHERE id = $1`, [record.id]),
    ).rejects.toThrow('Audit records are immutable and cannot be deleted');
  });

  it('should create all required indexes', async () => {
    await migration.up(dataSource.createQueryRunner());

    const indexes = await dataSource.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'audit_records'
      AND indexname IN ('idx_audit_actor_time', 'idx_audit_resource_time', 'idx_audit_change_detail')
    `);

    expect(indexes).toHaveLength(3);
  });

  it('should apply data classification comments', async () => {
    await migration.up(dataSource.createQueryRunner());

    const confidentialColumns = await dataSource.query(`
      SELECT column_name
      FROM information_schema.columns c
      JOIN pg_class pgc ON pgc.relname = c.table_name
      JOIN pg_description pgd ON pgd.objoid = pgc.oid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_name = 'audit_records'
      AND c.table_schema = 'public'
      AND pgd.description = 'Confidential'
    `);

    expect(confidentialColumns.length).toBeGreaterThanOrEqual(3);
    const columnNames = confidentialColumns.map((c: any) => c.column_name);
    expect(columnNames).toEqual(
      expect.arrayContaining(['actor_id', 'change_detail', 'approval_chain']),
    );
  });

  it('should support partition pruning for time-range queries', async () => {
    await migration.up(dataSource.createQueryRunner());

    const currentDate = new Date();
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Insert records in current month
    const currentMonthRecords = createAuditRecordBatch(5, currentDate);
    for (const record of currentMonthRecords) {
      await dataSource.query(
        `
        INSERT INTO audit_records (
          id, actor_id, actor_role, action, resource_type, resource_id,
          change_detail, approval_chain, request_id, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          record.id,
          record.actorId,
          record.actorRole,
          record.action,
          record.resourceType,
          record.resourceId,
          JSON.stringify(record.changeDetail),
          JSON.stringify(record.approvalChain),
          record.requestId,
          record.occurredAt,
        ],
      );
    }

    // Insert records in next month
    const nextMonthRecords = createAuditRecordBatch(5, nextMonth, {
      actorId: 'user-next-month',
    });
    for (const record of nextMonthRecords) {
      await dataSource.query(
        `
        INSERT INTO audit_records (
          id, actor_id, actor_role, action, resource_type, resource_id,
          change_detail, approval_chain, request_id, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          record.id,
          record.actorId,
          record.actorRole,
          record.action,
          record.resourceType,
          record.resourceId,
          JSON.stringify(record.changeDetail),
          JSON.stringify(record.approvalChain),
          record.requestId,
          record.occurredAt,
        ],
      );
    }

    // Query with partition pruning (current month only)
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1,
    );

    const explainResult = await dataSource.query(
      `
      EXPLAIN (FORMAT JSON)
      SELECT * FROM audit_records
      WHERE occurred_at >= $1 AND occurred_at < $2
    `,
      [startOfMonth, endOfMonth],
    );

    const plan = JSON.stringify(explainResult);
    expect(plan).toContain('Seq Scan on audit_records');
    expect(plan).toContain(currentDate.getFullYear().toString());
  });

  it('should rollback cleanly', async () => {
    await migration.up(dataSource.createQueryRunner());
    await migration.down(dataSource.createQueryRunner());

    const tables = await dataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND (tablename = 'audit_records' OR tablename LIKE 'audit_records_%')
    `);

    expect(tables).toHaveLength(0);

    const functions = await dataSource.query(`
      SELECT proname FROM pg_proc
      WHERE proname IN ('audit_records_prevent_update', 'audit_records_prevent_delete', 'create_audit_partition')
    `);

    expect(functions).toHaveLength(0);
  });
});
