import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls?: {
    rejectUnauthorized: boolean;
  } | false;
  cacheTtlSeconds: number;
  maxRetriesPerRequest: number | null;
}

export default registerAs(
  'redis',
  (): RedisConfig => {
    const nodeEnv = process.env['NODE_ENV'] || 'development';
    const host = process.env['REDIS_HOST'] || 'localhost';
    const port = parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const password = process.env['REDIS_PASSWORD'];
    const db = parseInt(process.env['REDIS_DB'] || '0', 10);
    const tlsEnabled = process.env['REDIS_TLS'] === 'true';
    const cacheTtlSeconds = parseInt(
      process.env['FLEET_CACHE_TTL_SECONDS'] || '300',
      10,
    );

    if (!host) {
      throw new Error('REDIS_HOST environment variable is required');
    }

    return {
      host,
      port,
      password,
      db,
      tls: tlsEnabled
        ? {
            rejectUnauthorized: nodeEnv === 'production',
          }
        : false,
      cacheTtlSeconds,
      maxRetriesPerRequest: null,
    };
  },
);

export const getRedisOptions = (config: RedisConfig): RedisOptions => {
  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    db: config.db,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
  };

  if (config.password) {
    options.password = config.password;
  }

  if (config.tls) {
    options.tls = config.tls;
  }

  return options;
};
