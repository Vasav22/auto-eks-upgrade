# Redis Module

The RedisModule provides Redis 7 integration for BullMQ job queues, caching, and Socket.IO pub/sub adapter.

## Features

- **Three Redis Connection Pools**: Separate clients for BullMQ queues, cache operations, and Socket.IO pub/sub
- **Five BullMQ Queues**: Pre-configured queues with concurrency limits and dead-letter queue support
- **Cache Service**: TTL-based caching with JSON serialization and error handling
- **Socket.IO Redis Adapter**: Cross-instance WebSocket pub/sub for horizontal scaling
- **TLS Support**: Conditional SSL/TLS for production environments
- **Health Checks**: Redis connectivity monitoring for Kubernetes probes

## Configuration

Redis configuration is loaded from environment variables:

```bash
REDIS_HOST=localhost          # Redis hostname
REDIS_PORT=6379               # Redis port (default: 6379)
REDIS_PASSWORD=               # Redis password (optional)
REDIS_DB=0                    # Redis database number (default: 0)
REDIS_TLS=false               # Enable TLS (true for staging/production)
FLEET_CACHE_TTL_SECONDS=300   # Default cache TTL in seconds (default: 300 = 5 minutes)
```

## BullMQ Queues

### Queue Configuration

| Queue Name        | Concurrency | Purpose                            |
|-------------------|-----------|------------------------------------|
| `upgrade-poll`    | 10        | Poll AWS EKS upgrade status        |
| `health-check`    | 5         | Check cluster and node health      |
| `backup`          | 3         | Create and manage backups          |
| `discovery`       | 2         | Discover EKS clusters in accounts  |
| `purge`           | 1         | Purge old data based on retention  |

### Dead Letter Queues

Each queue has a DLQ configured with:
- Maximum retry attempts: 3
- Backoff strategy: Exponential
- Initial delay: 5 seconds
- Backoff factor: 2

### Job Payload Interfaces

```typescript
// Upgrade Poll
interface UpgradePollPayload {
  jobId: string;
  clusterId: string;
  awsUpdateId: string;
  accountRoleArn: string;
}

// Health Check
interface HealthCheckPayload {
  jobId: string;
  clusterId: string;
  upgradeJobId: string;
}

// Backup
interface BackupPayload {
  clusterId: string;
  backupScope: 'full' | 'incremental' | 'config-only';
  storageLocation: string;
}

// Discovery
interface DiscoveryPayload {
  accountId: string;
  regions: string[];
}

// Purge
interface PurgePayload {
  dataCategory: 'logs' | 'audit' | 'events' | 'jobs' | 'backups';
  retentionDays: number;
}
```

### Using Queues in Workers

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { UPGRADE_POLL_QUEUE } from '../redis/queues/queue.constants';
import { UpgradePollPayload } from '../redis/queues/payloads';

@Processor(UPGRADE_POLL_QUEUE)
export class UpgradePollWorker extends WorkerHost {
  async process(job: Job<UpgradePollPayload>): Promise<void> {
    const { jobId, clusterId, awsUpdateId, accountRoleArn } = job.data;
    // Process the upgrade poll job
  }
}
```

### Enqueuing Jobs

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UPGRADE_POLL_QUEUE } from '../redis/queues/queue.constants';
import { UpgradePollPayload } from '../redis/queues/payloads';

export class UpgradeService {
  constructor(
    @InjectQueue(UPGRADE_POLL_QUEUE)
    private upgradePollQueue: Queue<UpgradePollPayload>,
  ) {}

  async scheduleUpgradePoll(payload: UpgradePollPayload): Promise<void> {
    await this.upgradePollQueue.add('poll-upgrade', payload, {
      delay: 5000, // Delay 5 seconds before processing
    });
  }
}
```

## Cache Service

### API

```typescript
// Get value by key (returns null if not found or expired)
async get<T>(key: string): Promise<T | null>

// Set value with TTL in seconds
async set<T>(key: string, value: T, ttlSeconds: number): Promise<void>

// Delete key
async del(key: string): Promise<void>

// Get or compute value if not cached
async getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number
): Promise<T>
```

### Usage Example

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../redis/cache/cache.service';

@Injectable()
export class FleetService {
  constructor(private cacheService: CacheService) {}

  async getFleetInventory(): Promise<FleetInventory> {
    return this.cacheService.getOrSet(
      'fleet:inventory',
      async () => {
        // Expensive computation to fetch all clusters
        return await this.fetchAllClustersFromDb();
      },
      300, // Cache for 5 minutes
    );
  }
}
```

## Socket.IO Redis Adapter

### Configuration

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createSocketIoRedisAdapter } from '../redis/adapters/socket-io-redis.adapter';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: any,
    @Inject('REDIS_PUBSUB_PUB') private pubClient: Redis,
    @Inject('REDIS_PUBSUB_SUB') private subClient: Redis,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    const adapter = createSocketIoRedisAdapter(this.pubClient, this.subClient);
    server.adapter(adapter);
    return server;
  }
}
```

## Health Checks

The Redis health check is included in the `/health/ready` endpoint:

```
GET /health/ready
```

**Response (HTTP 200 - Healthy):**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up", "message": "Redis is responsive" }
  },
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up", "message": "Redis is responsive" }
  }
}
```

## Testing

### Unit Tests

```bash
npm run test -- cache.service.spec
npm run test -- redis.health-indicator.spec
```

### Integration Tests

Start the test infrastructure:

```bash
docker-compose -f docker-compose.test.yml up -d
```

Run integration tests:

```bash
npm run test -- redis.integration.spec
```

Stop the test infrastructure:

```bash
docker-compose -f docker-compose.test.yml down -v
```

## Environment Profiles

### Development
- TLS: disabled
- Host: localhost
- Port: 6379
- Cache TTL: 300s (5 minutes)

### Staging
- TLS: enabled (rejectUnauthorized: false)
- Host: from environment
- Password: required
- Cache TTL: configurable

### Production
- TLS: enabled (rejectUnauthorized: true)
- Host: from environment (AWS ElastiCache)
- Password: from AWS Secrets Manager
- Cache TTL: configurable

## AWS ElastiCache Configuration

For production deployments using AWS ElastiCache:

```bash
# Enable TLS
REDIS_TLS=true

# ElastiCache endpoint
REDIS_HOST=eks-upgrade-prod.xxxxx.cache.amazonaws.com
REDIS_PORT=6379

# Use AWS Secrets Manager to inject password
REDIS_PASSWORD=${REDIS_PASSWORD_FROM_SECRETS_MANAGER}
```
