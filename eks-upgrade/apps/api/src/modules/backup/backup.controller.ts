import { Controller, Get } from '@nestjs/common';
import { BackupService } from './backup.service';

@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('health')
  health(): string {
    return this.backupService.health();
  }
}
