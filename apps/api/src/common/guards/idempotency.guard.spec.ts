import { IdempotencyGuard } from './idempotency.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ConflictException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

describe('IdempotencyGuard', () => {
  let guard: IdempotencyGuard;
  let reflector: Reflector;
  let redisService: RedisService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
    };

    reflector = {
      get: jest.fn(),
    } as any;

    redisService = {
      getClient: jest.fn().mockResolvedValue(mockRedisClient),
    } as any;

    guard = new IdempotencyGuard(reflector, redisService);
  });

  const createMockContext = (
    headers: Record<string, string> = {},
    userId: string = 'test-user',
  ): ExecutionContext => ({
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => ({
        headers,
        method: 'POST',
        url: '/api/test',
        user: { id: userId },
      }),
    }),
  } as any);

  it('should allow request when idempotency is not required', async () => {
    (reflector.get as jest.Mock).mockReturnValue(false);

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisClient.get).not.toHaveBeenCalled();
  });

  it('should allow request when idempotency key is missing', async () => {
    (reflector.get as jest.Mock).mockReturnValue(true);

    const context = createMockContext({});
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisClient.get).not.toHaveBeenCalled();
  });

  it('should allow request with new idempotency key', async () => {
    (reflector.get as jest.Mock).mockReturnValue(true);
    mockRedisClient.get.mockResolvedValue(null);

    const context = createMockContext({ 'idempotency-key': 'test-key-123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      'idempotency:test-user:test-key-123',
    );
    expect(mockRedisClient.setex).toHaveBeenCalled();
  });

  it('should reject duplicate request', async () => {
    (reflector.get as jest.Mock).mockReturnValue(true);
    mockRedisClient.get.mockResolvedValue(JSON.stringify({
      timestamp: new Date().toISOString(),
    }));

    const context = createMockContext({ 'idempotency-key': 'test-key-123' });

    await expect(guard.canActivate(context)).rejects.toThrow(ConflictException);
    expect(mockRedisClient.setex).not.toHaveBeenCalled();
  });
});
