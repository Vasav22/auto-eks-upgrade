import databaseConfig from './database.config';

describe('DatabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('development profile', () => {
    it('should load development configuration with defaults', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_HOST'] = 'localhost';
      process.env['DATABASE_USER'] = 'postgres';
      process.env['DATABASE_PASSWORD'] = 'postgres';
      process.env['DATABASE_NAME'] = 'eks_upgrade_dev';

      const config = databaseConfig();

      expect(config.type).toBe('postgres');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.username).toBe('postgres');
      expect(config.database).toBe('eks_upgrade_dev');
      expect(config.poolSize).toBe(20);
      expect(config.ssl).toBe(false);
      expect(config.synchronize).toBe(false);
      expect(config.logging).toEqual(['query', 'error', 'warn']);
    });
  });

  describe('staging profile', () => {
    it('should load staging configuration with SSL enabled', () => {
      process.env['NODE_ENV'] = 'staging';
      process.env['DATABASE_HOST'] = 'db.staging.example.com';
      process.env['DATABASE_PORT'] = '5433';
      process.env['DATABASE_USER'] = 'eks_app';
      process.env['DATABASE_PASSWORD'] = 'secure_password';
      process.env['DATABASE_NAME'] = 'eks_upgrade_staging';
      process.env['DATABASE_SSL'] = 'true';

      const config = databaseConfig();

      expect(config.host).toBe('db.staging.example.com');
      expect(config.port).toBe(5433);
      expect(config.username).toBe('eks_app');
      expect(config.database).toBe('eks_upgrade_staging');
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.logging).toEqual(['error']);
    });
  });

  describe('production profile', () => {
    it('should load production configuration with strict SSL', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_HOST'] = 'db.prod.example.com';
      process.env['DATABASE_USER'] = 'eks_app';
      process.env['DATABASE_PASSWORD'] = 'super_secure_password';
      process.env['DATABASE_NAME'] = 'eks_upgrade_prod';
      process.env['DATABASE_SSL'] = 'true';

      const config = databaseConfig();

      expect(config.host).toBe('db.prod.example.com');
      expect(config.ssl).toEqual({ rejectUnauthorized: true });
      expect(config.synchronize).toBe(false);
      expect(config.logging).toEqual(['error']);
    });
  });

  describe('validation', () => {
    it('should throw error when required environment variables are missing', () => {
      delete process.env['DATABASE_HOST'];
      delete process.env['DATABASE_USER'];
      delete process.env['DATABASE_PASSWORD'];
      delete process.env['DATABASE_NAME'];

      expect(() => databaseConfig()).toThrow(
        'Missing required database configuration',
      );
    });
  });

  describe('pool configuration', () => {
    it('should always set pool size to 20', () => {
      process.env['DATABASE_HOST'] = 'localhost';
      process.env['DATABASE_USER'] = 'postgres';
      process.env['DATABASE_PASSWORD'] = 'postgres';
      process.env['DATABASE_NAME'] = 'test_db';

      const config = databaseConfig();

      expect(config.poolSize).toBe(20);
    });
  });

  describe('migrations configuration', () => {
    it('should configure migrations table and directory', () => {
      process.env['DATABASE_HOST'] = 'localhost';
      process.env['DATABASE_USER'] = 'postgres';
      process.env['DATABASE_PASSWORD'] = 'postgres';
      process.env['DATABASE_NAME'] = 'test_db';

      const config = databaseConfig();

      expect(config.migrationsRun).toBe(false);
      expect(config.migrationsTableName).toBe('typeorm_migrations');
      expect(config.migrations).toHaveLength(1);
    });
  });
});
