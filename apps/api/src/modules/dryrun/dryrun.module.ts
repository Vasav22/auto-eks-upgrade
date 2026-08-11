import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeGroupEntity } from '../node-groups/entities/node-group.entity';
import { DryRunService } from './services/dryrun.service';
import { DeprecatedApiScannerService } from './services/deprecated-api-scanner.service';
import { PdbAnalysisService } from './services/pdb-analysis.service';
import { DryRunController } from './controllers/dryrun.controller';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NodeGroupEntity]),
    ClusterModule,
    AuditModule,
  ],
  controllers: [DryRunController],
  providers: [DryRunService, DeprecatedApiScannerService, PdbAnalysisService],
  exports: [DryRunService],
})
export class DryRunModule {}
