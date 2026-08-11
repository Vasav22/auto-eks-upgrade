import { Controller, Get } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('health')
  health(): string {
    return this.notificationService.health();
  }
}
