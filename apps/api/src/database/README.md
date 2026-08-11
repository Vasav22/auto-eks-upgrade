# Database Module

The DatabaseModule provides TypeORM integration with PostgreSQL 16 for the EKS Upgrade Control Plane.

## Features

- **TypeORM Integration**: Fully configured TypeORM DataSource with PostgreSQL driver
- **Connection Pooling**: 20 connections per API instance for optimal performance
- **Environment-Specific Configuration**: Separate settings for dev, staging, and production
- **SSL/TLS Support**: Conditional SSL based on environment with certificate validation
- **Migration Framework**: Timestamp-based migration system with CLI commands
- **Health Checks**: Database connectivity monitoring for Kubernetes probes

## Configuration

Database configuration is loaded from environment variables:

```bash
DATABASE_HOST=localhost          # Database hostname
DATABASE_PORT=5432               # Database port (default: 5432)
DATABASE_NAME=eks_upgrade        # Database name
DATABASE_USER=postgres           # Database user
DATABASE_PASSWORD=postgres       # Database password
DATABASE_SSL=false               # Enable SSL (true for staging/production)
```

## Migrations

### Migration Naming Convention

Migrations use a timestamp-based naming convention:

```
[timestamp]-[DescriptiveName].ts
```

Example: `1700000000000-CreateUsersTable.ts`

### CLI Commands

```bash
# Run pending migrations
npm run typeorm:migration:run

# Revert the last migration
npm run typeorm:migration:revert

# Generate migration from entity changes
npm run typeorm:migration:generate -- src/database/migrations/MigrationName

# Create blank migration
npm run typeorm:migration:create -- src/database/migrations/MigrationName
```

### Migration Template

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrationName1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your migration logic here
    await queryRunner.query(`CREATE TABLE "users" (...)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add rollback logic here
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

## Health Checks

The health check endpoint verifies database connectivity:

```
GET /health/ready
```

**Response (HTTP 200 - Healthy):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

**Response (HTTP 503 - Unhealthy):**
```json
{
  "status": "error",
  "error": {
    "database": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

## Testing

### Unit Tests

```bash
npm run test -- database.config.spec
npm run test -- health.controller.spec
```

### Integration Tests

Start the test database:

```bash
docker-compose -f docker-compose.test.yml up -d
```

Run integration tests:

```bash
npm run test -- database.integration.spec
```

Stop the test database:

```bash
docker-compose -f docker-compose.test.yml down -v
```

## Usage in Domain Modules

Import repositories in your domain modules:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
})
export class UserModule {}
```

Inject repositories in services:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }
}
```

## Environment Profiles

### Development
- Logging: query, error, warn
- SSL: disabled
- Pool size: 20

### Staging
- Logging: error only
- SSL: enabled (rejectUnauthorized: false)
- Pool size: 20

### Production
- Logging: error only
- SSL: enabled (rejectUnauthorized: true)
- Pool size: 20
