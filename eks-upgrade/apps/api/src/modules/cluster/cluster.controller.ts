import { Controller, Get } from '@nestjs/common';
import { ClusterService } from './cluster.service';

@Controller('clusters')
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get('health')
  health(): string {
    return this.clusterService.health();
  }
}
