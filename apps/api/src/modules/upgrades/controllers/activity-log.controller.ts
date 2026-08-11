import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ActivityLogService } from '../services/activity-log.service';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('upgrades/:upgradeJobId/activity-log')
@UseGuards(AuthGuard, RolesGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  async getActivityLog(
    @Param('upgradeJobId') upgradeJobId: string,
    @Query('fromSequence', new ParseIntPipe({ optional: true }))
    fromSequence?: number,
  ) {
    const events = await this.activityLogService.getActivityLog(
      upgradeJobId,
      fromSequence,
    );

    return {
      upgradeJobId,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        eventData: e.eventData,
        sequenceNumber: e.sequenceNumber,
        timestamp: e.timestamp,
      })),
      count: events.length,
    };
  }

  @Get('latest-sequence')
  @Roles('admin', 'operator', 'viewer')
  async getLatestSequence(@Param('upgradeJobId') upgradeJobId: string) {
    const sequence = await this.activityLogService.getLatestSequence(
      upgradeJobId,
    );
    return {
      upgradeJobId,
      latestSequence: sequence,
    };
  }

  @Get('detect-gap')
  @Roles('admin', 'operator', 'viewer')
  async detectGap(
    @Param('upgradeJobId') upgradeJobId: string,
    @Query('clientLastSequence', ParseIntPipe) clientLastSequence: number,
  ) {
    const result = await this.activityLogService.detectGap(
      upgradeJobId,
      clientLastSequence,
    );

    return {
      upgradeJobId,
      clientLastSequence,
      hasGap: result.hasGap,
      missingEventsCount: result.missingEvents.length,
      missingEvents: result.missingEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        eventData: e.eventData,
        sequenceNumber: e.sequenceNumber,
        timestamp: e.timestamp,
      })),
    };
  }

  @Get('count')
  @Roles('admin', 'operator', 'viewer')
  async getEventCount(@Param('upgradeJobId') upgradeJobId: string) {
    const count = await this.activityLogService.countEventsForJob(
      upgradeJobId,
    );
    return {
      upgradeJobId,
      eventCount: count,
    };
  }
}
