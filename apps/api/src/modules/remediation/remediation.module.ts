import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemediationProposalEntity } from './entities/remediation-proposal.entity';
import { RemediationService } from './services/remediation.service';
import { RemediationController } from './controllers/remediation.controller';
import { AuditModule } from '../audit/audit.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RemediationProposalEntity]),
    AuditModule,
    GatewaysModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [RemediationController],
  providers: [RemediationService],
  exports: [RemediationService],
})
export class RemediationModule {}
