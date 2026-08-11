import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { FleetService } from '../services/fleet.service';

@Controller('fleet')
@UseGuards(AuthGuard, RolesGuard)
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('status')
  @Roles('admin', 'operator', 'viewer')
  getFleetStatus() {
    return this.fleetService.getFleetStatus();
  }

  @Get('clusters')
  @Roles('admin', 'operator', 'viewer')
  getClusters(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fleetService.getClusters(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }
}
