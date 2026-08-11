import { Controller, Get } from '@nestjs/common';
import { CampaignService } from './campaign.service';

@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get('health')
  health(): string {
    return this.campaignService.health();
  }
}
