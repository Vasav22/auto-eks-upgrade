import { Controller, Get } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('health')
  health(): string {
    return this.scheduleService.health();
  }
}
