import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HealthCheckEntity } from './entities/health-check.entity';
import { HealthService } from './services/health.service';
import { HealthCheckWorker } from './workers/health-check.worker';
import { HealthController } from './controllers/health.controller';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HealthCheckEntity]),
    BullModule.registerQueue({ name: 'health-check' }),
    ClusterModule,
    AuditModule,
    GatewaysModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, HealthCheckWorker],
  exports: [HealthService],
})
export class HealthModule {}
