import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UpgradeScheduleEntity } from './entities/upgrade-schedule.entity';
import { SchedulingService } from './services/scheduling.service';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UpgradeScheduleEntity]),
    ScheduleModule.forRoot(),
    ClusterModule,
    AuditModule,
  ],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
