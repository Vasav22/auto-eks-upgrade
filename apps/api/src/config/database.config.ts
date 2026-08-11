import { registerAs } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface DatabaseConfig extends Omit<PostgresConnectionOptions, 'type'> {
  type: 'postgres';
}

export default registerAs(
  'database',
  (): DatabaseConfig => {
    const nodeEnv = process.env['NODE_ENV'] || 'development';
    const host = process.env['DATABASE_HOST'] || 'localhost';
    const port = parseInt(process.env['DATABASE_PORT'] || '5432', 10);
    const username = process.env['DATABASE_USER'] || 'postgres';
    const password = process.env['DATABASE_PASSWORD'] || 'postgres';
    const database = process.env['DATABASE_NAME'] || 'eks_upgrade_dev';
    const sslEnabled = process.env['DATABASE_SSL'] === 'true';

    if (!host || !username || !password || !database) {
      throw new Error(
        'Missing required database configuration: DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME must be set',
      );
    }

    return {
      type: 'postgres',
      host,
      port,
      username,
      password,
      database,
      poolSize: 20,
      ssl: sslEnabled
        ? {
            rejectUnauthorized: nodeEnv === 'production',
          }
        : false,
      synchronize: false,
      logging: nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/**/*{.ts,.js}'],
      migrationsRun: false,
      migrationsTableName: 'typeorm_migrations',
    };
  },
);
