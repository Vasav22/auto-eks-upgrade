import { Test, TestingModule } from '@nestjs/testing';
import { RedisHealthIndicator } from './redis.health-indicator';
import { HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      ping: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: 'REDIS_CACHE_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return healthy status when Redis responds with PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
          message: 'Redis is responsive',
        },
      });
    });

    it('should throw HealthCheckError when Redis connection fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should throw HealthCheckError when Redis returns unexpected response', async () => {
      mockRedis.ping.mockResolvedValue('UNEXPECTED');

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
    });
  });
});
