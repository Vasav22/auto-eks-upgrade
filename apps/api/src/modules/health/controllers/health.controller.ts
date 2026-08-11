import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { HealthService } from '../services/health.service';

@Controller('clusters/:clusterId/health')
@UseGuards(AuthGuard, RolesGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Post('check')
  @Roles('admin', 'operator')
  async triggerHealthCheck(@Param('clusterId') clusterId: string, @Request() req: any) {
    return this.healthService.triggerHealthCheck(clusterId, 'MANUAL', req.user.id);
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  async listHealthChecks(@Param('clusterId') clusterId: string) {
    return this.healthService.listForCluster(clusterId);
  }

  @Get('latest')
  @Roles('admin', 'operator', 'viewer')
  async getLatestHealthCheck(@Param('clusterId') clusterId: string) {
    return this.healthService.getLatestHealthCheck(clusterId);
  }
}
