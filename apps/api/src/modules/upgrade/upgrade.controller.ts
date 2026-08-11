import { Controller, Get } from '@nestjs/common';
import { UpgradeService } from './upgrade.service';

@Controller('upgrades')
export class UpgradeController {
  constructor(private readonly upgradeService: UpgradeService) {}

  @Get('health')
  health(): string {
    return this.upgradeService.health();
  }
}
