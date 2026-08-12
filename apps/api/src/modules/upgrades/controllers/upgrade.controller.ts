import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UpgradeService } from '../services/upgrade.service';
import { CreateUpgradeDto } from '../dto/create-upgrade.dto';
import { IsArray, IsString } from 'class-validator';

class BulkUpgradeDto {
  @IsArray()
  @IsString({ each: true })
  clusterIds!: string[];

  @IsString()
  targetVersion!: string;

  dryRun?: boolean;
}
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { IdempotencyGuard } from '../../../common/guards/idempotency.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';

@Controller('upgrades')
@UseGuards(AuthGuard, RolesGuard)
export class UpgradeController {
  constructor(private readonly upgradeService: UpgradeService) {}

  @Post()
  @Roles('admin', 'operator')
  @UseGuards(IdempotencyGuard)
  @Idempotent()
  async createUpgrade(
    @Body() dto: CreateUpgradeDto,
    @Request() req: any,
  ) {
    return this.upgradeService.createUpgradeJob(dto, req.user.id);
  }

  @Post('bulk')
  @Roles('admin', 'operator')
  async bulkUpgrade(@Body() dto: BulkUpgradeDto, @Request() req: any) {
    const results = await Promise.allSettled(
      dto.clusterIds.map((clusterId) =>
        this.upgradeService.createUpgradeJob(
          { clusterId, targetVersion: dto.targetVersion, dryRun: dto.dryRun },
          req.user.id,
        ),
      ),
    );

    return {
      total: dto.clusterIds.length,
      succeeded: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
      results: results.map((r, i) => ({
        clusterId: dto.clusterIds[i],
        status: r.status === 'fulfilled' ? 'queued' : 'error',
        jobId: r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any>).value.id : undefined,
        error: r.status === 'rejected' ? (r as PromiseRejectedResult).reason?.message : undefined,
      })),
    };
  }

  @Get()
  @Roles('admin', 'operator', 'viewer')
  async listUpgrades(@Query('clusterId') clusterId?: string) {
    return this.upgradeService.listUpgradeJobs(clusterId);
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  async getUpgrade(@Param('id') id: string) {
    return this.upgradeService.getUpgradeJob(id);
  }

  @Delete(':id')
  @Roles('admin', 'operator')
  async cancelUpgrade(@Param('id') id: string, @Request() req: any) {
    return this.upgradeService.cancelUpgradeJob(id, req.user.id);
  }
}
