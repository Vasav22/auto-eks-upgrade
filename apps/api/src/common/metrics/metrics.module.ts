import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusService } from './prometheus.service';
import { MetricsController } from './metrics.controller';
import { ClusterEntity } from '../../modules/clusters/entities/cluster.entity';
import { HealthCheckEntity } from '../../modules/health/entities/health-check.entity';
import { UpgradeJobEntity } from '../../database/entities/upgrade-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClusterEntity, HealthCheckEntity, UpgradeJobEntity]),
  ],
  controllers: [MetricsController],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class MetricsModule {}
