import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  health(): string {
    return 'AuditService is healthy';
  }
}
