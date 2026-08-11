import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupPolicyEntity } from './entities/backup-policy.entity';
import { BackupEntity } from './entities/backup.entity';
import { RestoreEntity } from './entities/restore.entity';
import { BackupService } from './services/backup.service';
import { BackupController, RestoreController } from './controllers/backup.controller';
import { AuditModule } from '../audit/audit.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupPolicyEntity, BackupEntity, RestoreEntity]),
    AuditModule,
    GatewaysModule,
    HealthModule,
  ],
  controllers: [BackupController, RestoreController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
