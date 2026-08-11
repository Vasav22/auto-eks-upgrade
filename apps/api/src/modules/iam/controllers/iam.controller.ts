import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { StsService } from '../services/sts.service';

class UpsertCredentialDto {
  accountId: string;
  accountAlias?: string;
  roleArn: string;
  externalId?: string;
  rotationIntervalDays?: number;
}

@Controller('iam/credentials')
@UseGuards(AuthGuard, RolesGuard)
export class IamController {
  constructor(private readonly stsService: StsService) {}

  @Get()
  @Roles('admin', 'operator')
  listCredentials() {
    return this.stsService.listCredentials();
  }

  @Post()
  @Roles('admin')
  upsertCredential(@Body() dto: UpsertCredentialDto) {
    return this.stsService.upsertCredential(dto);
  }

  @Post(':accountId/validate')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'operator')
  validateCredential(@Param('accountId') accountId: string) {
    return this.stsService.validateCredential(accountId);
  }

  @Get('rotation-due')
  @Roles('admin')
  checkRotationDue() {
    return this.stsService.checkRotationDue();
  }
}
