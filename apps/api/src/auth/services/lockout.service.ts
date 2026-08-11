import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AUTH_CONFIG } from '../constants/auth-config';

@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: configService.get<number>('REDIS_PORT') ?? 6379,
      password: configService.get<string>('REDIS_PASSWORD'),
      db: configService.get<number>('REDIS_DB') ?? 0,
    });
  }

  async recordFailedAttempt(ip: string): Promise<number> {
    const key = `auth:failed_attempts:${ip}`;
    const lockoutKey = `auth:lockout:${ip}`;

    try {
      const attempts = await this.redis.incr(key);
      
      if (attempts === 1) {
        // Set TTL on first attempt
        await this.redis.expire(key, AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60);
      }

      if (attempts >= AUTH_CONFIG.MAX_FAILED_ATTEMPTS) {
        // Trigger lockout
        await this.redis.setex(
          lockoutKey,
          AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60,
          '1',
        );
        this.logger.warn(`IP ${ip} locked out after ${attempts} failed attempts`);
      }

      return attempts;
    } catch (error: unknown) {
      this.logger.error(`Failed to record attempt: ${(error as Error).message}`);
      return 0;
    }
  }

  async isLockedOut(ip: string): Promise<boolean> {
    const lockoutKey = `auth:lockout:${ip}`;

    try {
      const result = await this.redis.exists(lockoutKey);
      return result === 1;
    } catch (error: unknown) {
      this.logger.error(`Failed to check lockout: ${(error as Error).message}`);
      // Fail closed: if Redis is down, assume locked out
      return true;
    }
  }

  async getRemainingLockoutSeconds(ip: string): Promise<number> {
    const lockoutKey = `auth:lockout:${ip}`;

    try {
      const ttl = await this.redis.ttl(lockoutKey);
      return ttl > 0 ? ttl : 0;
    } catch (error: unknown) {
      this.logger.error(`Failed to get lockout TTL: ${(error as Error).message}`);
      return 0;
    }
  }

  async clearFailedAttempts(ip: string): Promise<void> {
    const key = `auth:failed_attempts:${ip}`;
    await this.redis.del(key);
  }
}
