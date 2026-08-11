import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONFIG } from '../constants/auth-config';
import { RequestWithUser } from '../guards/auth.guard';

@Injectable()
export class IdleTimeoutMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdleTimeoutMiddleware.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: configService.get<number>('REDIS_PORT') ?? 6379,
      password: configService.get<string>('REDIS_PASSWORD'),
      db: configService.get<number>('REDIS_DB') ?? 0,
    });
  }

  async use(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    const user = req.user;

    if (!user) {
      // Not authenticated, skip idle timeout check
      next();
      return;
    }

    const key = `auth:last_activity:${user.id}`;
    const now = Date.now();

    try {
      const lastActivityStr = await this.redis.get(key);

      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        const idleMinutes = (now - lastActivity) / 1000 / 60;

        if (idleMinutes > AUTH_CONFIG.IDLE_TIMEOUT_MINUTES) {
          this.logger.warn(`Session idle timeout for user ${user.id}`);
          throw new UnauthorizedException({
            error: 'SESSION_IDLE_TIMEOUT',
            message: 'Session expired due to inactivity',
          });
        }
      }

      // Update last activity timestamp
      await this.redis.setex(
        key,
        AUTH_CONFIG.ABSOLUTE_TIMEOUT_HOURS * 60 * 60,
        now.toString(),
      );

      next();
    } catch (error: unknown) {
      if ((error as any).status === 401) {
        throw error;
      }
      this.logger.error(`Idle timeout check failed: ${(error as Error).message}`);
      next();
    }
  }
}
