import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../services/rate-limiter.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(private rateLimiter: RateLimiterService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = req.ip ?? 'unknown';
    const result = await this.rateLimiter.checkRateLimit(ip);

    if (!result.allowed) {
      this.logger.warn(`Rate limit exceeded for IP ${ip}`);
      res
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .header('Retry-After', result.retryAfterSeconds.toString())
        .json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: result.retryAfterSeconds,
        });
      return;
    }

    next();
  }
}
