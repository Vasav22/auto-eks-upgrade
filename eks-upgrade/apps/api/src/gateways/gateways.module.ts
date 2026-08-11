import { Module } from '@nestjs/common';
import { UpgradeEventsGateway } from './upgrade-events.gateway';

@Module({
  providers: [UpgradeEventsGateway],
  exports: [UpgradeEventsGateway],
})
export class GatewaysModule {}
