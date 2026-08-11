import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditRecord } from './entities/audit-record.entity';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';
import { AuditExportWorker } from './workers/audit-export.worker';
import { PartitionManager } from './utils/partition-manager';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditRecord]),
    BullModule.registerQueue({
      name: 'audit-export',
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditExportWorker, PartitionManager],
  exports: [AuditService, PartitionManager],
})
export class AuditModule {}
