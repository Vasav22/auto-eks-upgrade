import { Injectable } from '@nestjs/common';

@Injectable()
export class ScheduleService {
  health(): string {
    return 'ScheduleService is healthy';
  }
}
