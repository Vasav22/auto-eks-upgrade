import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import databaseConfig from '../config/database.config';
import { DatabaseModule } from './database.module';

describe('DatabaseModule Integration', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env['DATABASE_HOST'] = 'localhost';
    process.env['DATABASE_PORT'] = '5433';
    process.env['DATABASE_NAME'] = 'eks_upgrade_test';
    process.env['DATABASE_USER'] = 'postgres';
    process.env['DATABASE_PASSWORD'] = 'postgres';
    process.env['DATABASE_SSL'] = 'false';
    process.env['NODE_ENV'] = 'test';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig],
        }),
        DatabaseModule,
      ],
    }).compile();

    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await module?.close();
  });

  it('should initialize database connection', () => {
    expect(dataSource).toBeDefined();
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should connect to PostgreSQL database', async () => {
    const result = await dataSource.query('SELECT version()');
    expect(result).toBeDefined();
    expect(result[0].version).toContain('PostgreSQL');
  });

  it('should have migrations table configured', () => {
    expect(dataSource.options.migrationsTableName).toBe('typeorm_migrations');
  });

  it('should have synchronize disabled', () => {
    expect(dataSource.options.synchronize).toBe(false);
  });

  it('should have pool size of 20', () => {
    const options = dataSource.options as any;
    expect(options.poolSize).toBe(20);
  });

  describe('migrations', () => {
    it('should run migrations successfully', async () => {
      await dataSource.runMigrations();
      const migrations = await dataSource.showMigrations();
      expect(migrations).toBe(false);
    });

    it('should revert migrations successfully', async () => {
      try {
        await dataSource.undoLastMigration();
      } catch (error: any) {
        expect(error.message).toContain('No migrations');
      }
    });
  });
});
