import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignTargetEntity } from './entities/campaign-target.entity';
import { CampaignService } from './services/campaign.service';
import { CampaignController } from './controllers/campaign.controller';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';
import { GatewaysModule } from '../../gateways/gateways.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CampaignEntity, CampaignTargetEntity]),
    ClusterModule,
    AuditModule,
    GatewaysModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
