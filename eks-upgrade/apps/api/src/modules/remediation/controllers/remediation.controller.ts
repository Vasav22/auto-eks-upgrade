import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RemediationService } from '../services/remediation.service';

@Controller('remediation')
@UseGuards(AuthGuard, RolesGuard)
export class RemediationController {
  constructor(private readonly remediationService: RemediationService) {}

  @Post('generate/:healthCheckId')
  @Roles('admin', 'operator')
  async generateProposals(@Param('healthCheckId') healthCheckId: string, @Request() req: any) {
    return this.remediationService.generateProposals(healthCheckId, req.user.id);
  }

  @Get('pending/:clusterId')
  @Roles('admin', 'operator', 'viewer')
  async listPending(@Param('clusterId') clusterId: string) {
    return this.remediationService.listPendingProposals(clusterId);
  }

  @Post(':proposalId/approve')
  @Roles('admin')
  async approveProposal(@Param('proposalId') proposalId: string, @Request() req: any) {
    return this.remediationService.approveProposal(proposalId, req.user.id);
  }

  @Post(':proposalId/reject')
  @Roles('admin')
  async rejectProposal(
    @Param('proposalId') proposalId: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.remediationService.rejectProposal(proposalId, body.reason, req.user.id);
  }

  @Post(':proposalId/execute')
  @Roles('admin')
  async executeProposal(@Param('proposalId') proposalId: string, @Request() req: any) {
    return this.remediationService.executeApprovedProposal(proposalId, req.user.id);
  }
}
