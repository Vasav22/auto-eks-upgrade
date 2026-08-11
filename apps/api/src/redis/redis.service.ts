import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @Inject('REDIS_CACHE_CLIENT') private readonly cacheClient: Redis,
    @Inject('REDIS_PUBSUB_PUB') private readonly pubClient: Redis,
  ) {}

  /** General-purpose client (get/set/setex/del/etc.) */
  async getClient(): Promise<Redis> {
    return this.cacheClient;
  }

  /** Pub/sub publish client */
  async getPubClient(): Promise<Redis> {
    return this.pubClient;
  }
}
