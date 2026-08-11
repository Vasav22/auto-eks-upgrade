import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ClusterService } from '../services/cluster.service';
import { RegisterAccountDto } from '../dto/register-account.dto';
import { DiscoverClustersDto } from '../dto/discover-clusters.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('clusters')
@UseGuards(AuthGuard, RolesGuard)
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Post('accounts')
  @Roles('cluster_admin', 'upgrade_operator')
  async registerAccount(
    @Body() dto: RegisterAccountDto,
    @Request() req: any,
  ) {
    const account = await this.clusterService.registerAccount(
      dto,
      req.user.id,
    );
    return {
      id: account.id,
      accountName: account.accountName,
      defaultRegion: account.defaultRegion,
      createdAt: account.createdAt,
    };
  }

  @Post('discover')
  @Roles('cluster_admin', 'upgrade_operator')
  async discoverClusters(
    @Body() dto: DiscoverClustersDto,
    @Request() req: any,
  ) {
    return this.clusterService.discoverClusters(dto, req.user.id);
  }

  @Get('accounts')
  @Roles('cluster_admin', 'upgrade_operator', 'sre_oncall', 'compliance_reviewer')
  async listAccounts() {
    const accounts = await this.clusterService.listAccounts();
    return accounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      defaultRegion: account.defaultRegion,
      createdAt: account.createdAt,
    }));
  }

  @Get('accounts/:id')
  @Roles('cluster_admin', 'upgrade_operator', 'sre_oncall', 'compliance_reviewer')
  async getAccount(@Param('id') id: string) {
    const account = await this.clusterService.getAccountById(id);
    return {
      id: account.id,
      accountName: account.accountName,
      defaultRegion: account.defaultRegion,
      createdAt: account.createdAt,
    };
  }

  @Get()
  @Roles('cluster_admin', 'upgrade_operator', 'sre_oncall', 'compliance_reviewer')
  async listClusters(@Query('accountId') accountId?: string) {
    return this.clusterService.listClusters(accountId);
  }

  @Get(':id')
  @Roles('cluster_admin', 'upgrade_operator', 'sre_oncall', 'compliance_reviewer')
  async getCluster(@Param('id') id: string) {
    return this.clusterService.getClusterDetail(id);
  }
}
