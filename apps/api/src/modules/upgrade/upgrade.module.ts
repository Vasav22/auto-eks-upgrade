import { Module } from '@nestjs/common';
import { UpgradeController } from './upgrade.controller';
import { UpgradeService } from './upgrade.service';

@Module({
  controllers: [UpgradeController],
  providers: [UpgradeService],
  exports: [UpgradeService],
})
export class UpgradeModule {}
