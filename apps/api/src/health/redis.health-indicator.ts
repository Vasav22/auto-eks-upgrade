import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject('REDIS_CACHE_CLIENT') private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await this.redis.ping();
      const isHealthy = result === 'PONG';

      if (isHealthy) {
        return this.getStatus(key, true, { message: 'Redis is responsive' });
      }

      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { message: 'Unexpected ping response' }),
      );
    } catch (error: unknown) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: (error as Error).message || 'Connection failed',
        }),
      );
    }
  }
}
