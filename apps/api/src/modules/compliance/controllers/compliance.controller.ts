import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { ComplianceService } from '../services/compliance.service';

@Controller('compliance')
@UseGuards(AuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('report')
  @Roles('admin', 'compliance_reviewer', 'viewer')
  async getComplianceReport(@Query('days') days?: string) {
    return this.complianceService.generateReport(days ? parseInt(days) : 30);
  }
}
