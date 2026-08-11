import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import redisConfig, { getRedisOptions } from '../config/redis.config';
import { CacheService } from './cache/cache.service';
import { RedisService } from './redis.service';
import {
  QUEUE_NAMES,
  UPGRADE_POLL_QUEUE,
  HEALTH_CHECK_QUEUE,
  BACKUP_QUEUE,
  DISCOVERY_QUEUE,
  PURGE_QUEUE,
} from './queues/queue.constants';

@Global()
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [
        ConfigModule.forFeature(redisConfig),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const config = configService.get('redis');
            return {
              connection: getRedisOptions(config),
            };
          },
        }),
        BullModule.registerQueue(
          ...QUEUE_NAMES.map((name) => ({
            name,
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
              removeOnComplete: 1000,
              removeOnFail: false,
            },
          })),
        ),
      ],
      providers: [
        {
          provide: 'REDIS_CACHE_CLIENT',
          useFactory: (configService: ConfigService) => {
            const config = configService.get('redis');
            return new Redis(getRedisOptions(config));
          },
          inject: [ConfigService],
        },
        {
          provide: 'REDIS_PUBSUB_PUB',
          useFactory: (configService: ConfigService) => {
            const config = configService.get('redis');
            return new Redis(getRedisOptions({ ...config, maxRetriesPerRequest: 10 }));
          },
          inject: [ConfigService],
        },
        {
          provide: 'REDIS_PUBSUB_SUB',
          useFactory: (configService: ConfigService) => {
            const config = configService.get('redis');
            return new Redis(getRedisOptions({ ...config, maxRetriesPerRequest: 10 }));
          },
          inject: [ConfigService],
        },
        CacheService,
        RedisService,
      ],
      exports: [
        'REDIS_CACHE_CLIENT',
        'REDIS_PUBSUB_PUB',
        'REDIS_PUBSUB_SUB',
        CacheService,
        RedisService,
        BullModule,
      ],
    };
  }
}
