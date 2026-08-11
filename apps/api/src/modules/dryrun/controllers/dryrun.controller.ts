import { Controller, Post, Get, Param, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { DryRunService } from '../services/dryrun.service';

@Controller('clusters/:clusterId/dryrun')
@UseGuards(AuthGuard, RolesGuard)
export class DryRunController {
  constructor(private readonly dryRunService: DryRunService) {}

  @Post()
  @Roles('admin', 'operator')
  async runDryRun(
    @Param('clusterId') clusterId: string,
    @Body() body: { targetVersion: string },
    @Request() req: any,
  ) {
    return this.dryRunService.runDryRun(clusterId, body.targetVersion, req.user.id);
  }
}
