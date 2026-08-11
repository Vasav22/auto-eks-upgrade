import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DiscoverySchedulerService } from '../../../workers/discovery-scheduler.service';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

class TriggerDiscoveryDto {
  accountId: string;
  regions?: string[];
}

@Controller('discovery')
@UseGuards(AuthGuard, RolesGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryScheduler: DiscoverySchedulerService,
  ) {}

  @Post('trigger')
  @Roles('admin', 'operator')
  async triggerDiscovery(
    @Body() dto: TriggerDiscoveryDto,
    @Request() req: any,
  ) {
    const jobId = await this.discoveryScheduler.triggerDiscoveryForAccount(
      dto.accountId,
      req.user.id,
      dto.regions,
    );

    return {
      jobId,
      message: 'Discovery job queued successfully',
    };
  }

  @Get('jobs/:jobId')
  @Roles('admin', 'operator', 'viewer')
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.discoveryScheduler.getJobStatus(jobId);

    if (!status) {
      return {
        error: 'Job not found',
      };
    }

    return status;
  }
}
