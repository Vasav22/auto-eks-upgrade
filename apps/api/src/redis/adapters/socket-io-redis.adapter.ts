import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export function createSocketIoRedisAdapter(
  pubClient: Redis,
  subClient: Redis,
) {
  return createAdapter(pubClient, subClient);
}
