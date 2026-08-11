import { Controller, Get } from '@nestjs/common';
import { NodeGroupService } from './node-group.service';

@Controller('node-groups')
export class NodeGroupController {
  constructor(private readonly nodeGroupService: NodeGroupService) {}

  @Get('health')
  health(): string {
    return this.nodeGroupService.health();
  }
}
