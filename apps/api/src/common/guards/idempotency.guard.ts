import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

export const IDEMPOTENCY_KEY = 'idempotency';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly logger = new Logger(IdempotencyGuard.name);
  private readonly TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENCY_KEY,
      context.getHandler(),
    );

    if (!isIdempotent) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      this.logger.warn(
        `Idempotent endpoint called without Idempotency-Key header: ${request.method} ${request.url}`,
      );
      return true;
    }

    const userId = (request as any).user?.id || 'anonymous';
    const redisKey = `idempotency:${userId}:${idempotencyKey}`;

    const redis = await this.redisService.getClient();
    const existing = await redis.get(redisKey);

    if (existing) {
      this.logger.warn(
        `Duplicate request detected: ${idempotencyKey} for user ${userId}`,
      );
      throw new ConflictException(
        'Duplicate request detected. This operation is already in progress or has been completed.',
      );
    }

    await redis.setex(redisKey, this.TTL_SECONDS, JSON.stringify({
      timestamp: new Date().toISOString(),
      userId,
      method: request.method,
      url: request.url,
    }));

    this.logger.log(
      `Idempotency key registered: ${idempotencyKey} for user ${userId}`,
    );

    return true;
  }
}
