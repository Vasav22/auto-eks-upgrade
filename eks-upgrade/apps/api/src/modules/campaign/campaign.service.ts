import { Injectable } from '@nestjs/common';

@Injectable()
export class CampaignService {
  health(): string {
    return 'CampaignService is healthy';
  }
}
