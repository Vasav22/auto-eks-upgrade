import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  health(): string {
    return 'NotificationService is healthy';
  }
}
