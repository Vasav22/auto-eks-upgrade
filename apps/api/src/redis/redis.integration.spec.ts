import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { RedisModule } from './redis.module';
import { CacheService } from './cache/cache.service';
import {
  UPGRADE_POLL_QUEUE,
  HEALTH_CHECK_QUEUE,
  BACKUP_QUEUE,
  DISCOVERY_QUEUE,
  PURGE_QUEUE,
} from './queues/queue.constants';
import redisConfig from '../config/redis.config';

describe('RedisModule Integration', () => {
  let module: TestingModule;
  let cacheService: CacheService;
  let cacheClient: Redis;
  let pubClient: Redis;
  let subClient: Redis;

  beforeAll(async () => {
    process.env['REDIS_HOST'] = 'localhost';
    process.env['REDIS_PORT'] = '6380';
    process.env['REDIS_DB'] = '0';
    process.env['REDIS_TLS'] = 'false';
    process.env['FLEET_CACHE_TTL_SECONDS'] = '300';
    process.env['NODE_ENV'] = 'test';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [redisConfig],
        }),
        RedisModule.forRoot(),
      ],
    }).compile();

    cacheService = module.get(CacheService);
    cacheClient = module.get('REDIS_CACHE_CLIENT');
    pubClient = module.get('REDIS_PUBSUB_PUB');
    subClient = module.get('REDIS_PUBSUB_SUB');
  });

  afterAll(async () => {
    if (cacheClient) {
      await cacheClient.quit();
    }
    if (pubClient) {
      await pubClient.quit();
    }
    if (subClient) {
      await subClient.quit();
    }
    await module?.close();
  });

  afterEach(async () => {
    if (cacheClient) {
      await cacheClient.flushdb();
    }
  });

  it('should create three separate Redis clients', () => {
    expect(cacheClient).toBeDefined();
    expect(pubClient).toBeDefined();
    expect(subClient).toBeDefined();
    expect(cacheClient).toBeInstanceOf(Redis);
    expect(pubClient).toBeInstanceOf(Redis);
    expect(subClient).toBeInstanceOf(Redis);
  });

  it('should connect to Redis successfully', async () => {
    const result = await cacheClient.ping();
    expect(result).toBe('PONG');
  });

  describe('CacheService', () => {
    it('should set and get a value', async () => {
      const testData = { foo: 'bar', count: 42 };

      await cacheService.set('test-key', testData, 10);
      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
    });

    it('should respect TTL and expire keys', async () => {
      const testData = { foo: 'bar' };

      await cacheService.set('test-ttl-key', testData, 1);
      let result = await cacheService.get('test-ttl-key');
      expect(result).toEqual(testData);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      result = await cacheService.get('test-ttl-key');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      await cacheService.set('test-del-key', { foo: 'bar' }, 10);
      await cacheService.del('test-del-key');

      const result = await cacheService.get('test-del-key');
      expect(result).toBeNull();
    });

    it('should use getOrSet with factory function', async () => {
      const factory = jest.fn().mockResolvedValue({ computed: true });

      const result1 = await cacheService.getOrSet('test-factory-key', factory, 10);
      expect(result1).toEqual({ computed: true });
      expect(factory).toHaveBeenCalledTimes(1);

      const result2 = await cacheService.getOrSet('test-factory-key', factory, 10);
      expect(result2).toEqual({ computed: true });
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pub/Sub', () => {
    it('should publish and receive messages', (done) => {
      const testChannel = 'test-channel';
      const testMessage = JSON.stringify({ event: 'test', data: { foo: 'bar' } });

      subClient.subscribe(testChannel, (err) => {
        if (err) {
          done(err);
          return;
        }

        subClient.on('message', (channel, message) => {
          expect(channel).toBe(testChannel);
          expect(message).toBe(testMessage);
          done();
        });

        pubClient.publish(testChannel, testMessage);
      });
    }, 10000);
  });

  describe('Health Check', () => {
    it('should verify Redis connectivity', async () => {
      const result = await cacheClient.ping();
      expect(result).toBe('PONG');
    });
  });
});
