import { Injectable } from '@nestjs/common';

@Injectable()
export class BackupService {
  health(): string {
    return 'BackupService is healthy';
  }
}
