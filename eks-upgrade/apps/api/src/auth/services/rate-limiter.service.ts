import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AUTH_CONFIG } from '../constants/auth-config';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: configService.get<number>('REDIS_PORT') ?? 6379,
      password: configService.get<string>('REDIS_PASSWORD'),
      db: configService.get<number>('REDIS_DB') ?? 0,
    });
  }

  async checkRateLimit(ip: string): Promise<RateLimitResult> {
    const now = new Date();
    const minuteBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    const key = `auth:rate_limit:${ip}:${minuteBucket}`;

    try {
      const count = await this.redis.incr(key);

      if (count === 1) {
        // Set TTL on first request in this minute
        await this.redis.expire(key, 60);
      }

      if (count > AUTH_CONFIG.AUTH_RATE_LIMIT_PER_MINUTE) {
        const ttl = await this.redis.ttl(key);
        return {
          allowed: false,
          retryAfterSeconds: ttl > 0 ? ttl : 60,
        };
      }

      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    } catch (error: unknown) {
      this.logger.error(`Rate limit check failed: ${(error as Error).message}`);
      // Fail open: if Redis is down, allow the request
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }
  }
}
