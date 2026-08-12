import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PurgeWorker } from './purge.worker';
import { PurgeSchedulerService } from './purge-scheduler.service';
import { DiscoveryWorker } from './discovery.worker';
import { DiscoverySchedulerService } from './discovery-scheduler.service';
import { UpgradePollWorker } from './upgrade-poll.worker';
import { UpgradePollSchedulerService } from './upgrade-poll-scheduler.service';
import { DiscoveryController } from '../modules/clusters/controllers/discovery.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../modules/audit/audit.module';
import { ClusterModule } from '../modules/clusters/cluster.module';
import { GatewaysModule } from '../gateways/gateways.module';
import { UpgradeModule } from '../modules/upgrades/upgrade.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpgradeJobEntity } from '../database/entities/upgrade-job.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([UpgradeJobEntity]),
    BullModule.registerQueue({ name: 'purge' }),
    BullModule.registerQueue({ name: 'discovery' }),
    BullModule.registerQueue({ name: 'upgrade-poll' }),
    AuthModule,
    AuditModule,
    ClusterModule,
    GatewaysModule,
    UpgradeModule,
  ],
  providers: [
    PurgeWorker,
    PurgeSchedulerService,
    DiscoveryWorker,
    DiscoverySchedulerService,
    UpgradePollWorker,
    UpgradePollSchedulerService,
  ],
  controllers: [DiscoveryController],
  exports: [PurgeSchedulerService, DiscoverySchedulerService, UpgradePollSchedulerService],
})
export class WorkersModule {}
