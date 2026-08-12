import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterEntity } from '../clusters/entities/cluster.entity';
import { HealthCheckEntity } from '../health/entities/health-check.entity';
import { FleetService } from './services/fleet.service';
import { FleetController } from './controllers/fleet.controller';
import { GatewaysModule } from '../../gateways/gateways.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClusterEntity, HealthCheckEntity]),
    GatewaysModule,
    AuthModule,
  ],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
