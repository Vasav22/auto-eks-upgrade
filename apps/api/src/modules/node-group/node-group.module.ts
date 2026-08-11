import { Module } from '@nestjs/common';
import { NodeGroupController } from './node-group.controller';
import { NodeGroupService } from './node-group.service';

@Module({
  controllers: [NodeGroupController],
  providers: [NodeGroupService],
  exports: [NodeGroupService],
})
export class NodeGroupModule {}
