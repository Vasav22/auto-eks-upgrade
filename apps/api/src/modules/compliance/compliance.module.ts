import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterEntity } from '../clusters/entities/cluster.entity';
import { AuditRecord } from '../audit/entities/audit-record.entity';
import { HealthCheckEntity } from '../health/entities/health-check.entity';
import { ComplianceService } from './services/compliance.service';
import { ComplianceController } from './controllers/compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClusterEntity, AuditRecord, HealthCheckEntity])],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
