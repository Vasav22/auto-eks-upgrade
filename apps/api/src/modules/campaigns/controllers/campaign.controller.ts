import {
  Controller, Get, Post, Patch, Param, Body, Request, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CampaignService, CreateCampaignDto } from '../services/campaign.service';

@Controller('campaigns')
@UseGuards(AuthGuard, RolesGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @Roles('admin', 'operator')
  async createCampaign(@Body() dto: CreateCampaignDto, @Request() req: any) {
    return this.campaignService.createCampaign(dto, req.user.id);
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  async listCampaigns(@Request() req: any) {
    return this.campaignService.list(req.user.id);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  async getCampaign(@Param('id') id: string) {
    return this.campaignService.findById(id);
  }

  @Get(':id/progress')
  @Roles('admin', 'operator', 'viewer')
  async getCampaignProgress(@Param('id') id: string) {
    return this.campaignService.getProgressSummary(id);
  }

  @Post(':id/start')
  @Roles('admin', 'operator')
  async startCampaign(@Param('id') id: string, @Request() req: any) {
    return this.campaignService.startCampaign(id, req.user.id);
  }

  @Post(':id/pause')
  @Roles('admin', 'operator')
  async pauseCampaign(@Param('id') id: string, @Request() req: any) {
    return this.campaignService.pauseCampaign(id, req.user.id);
  }

  @Post(':id/screen-eligibility')
  @Roles('admin', 'operator')
  async screenEligibility(@Param('id') id: string, @Request() req: any) {
    await this.campaignService.screenEligibility(id, req.user.id);
    return { message: 'Eligibility screening complete' };
  }
}
