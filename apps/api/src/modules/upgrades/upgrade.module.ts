import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpgradeJobEntity } from '../../database/entities/upgrade-job.entity';
import { UpgradeEventEntity } from '../../database/entities/upgrade-event.entity';
import { UpgradeService } from './services/upgrade.service';
import { ActivityLogService } from './services/activity-log.service';
import { UpgradeController } from './controllers/upgrade.controller';
import { ActivityLogController } from './controllers/activity-log.controller';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UpgradeJobEntity, UpgradeEventEntity]),
    ClusterModule,
    AuditModule,
    AuthModule,
    RedisModule,
  ],
  providers: [UpgradeService, ActivityLogService],
  controllers: [UpgradeController, ActivityLogController],
  exports: [UpgradeService, ActivityLogService],
})
export class UpgradeModule {}
