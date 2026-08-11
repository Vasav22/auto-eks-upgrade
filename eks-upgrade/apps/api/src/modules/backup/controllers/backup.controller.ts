import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { BackupService } from '../services/backup.service';

@Controller('clusters/:clusterId/backups')
@UseGuards(AuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  listBackups(@Param('clusterId') clusterId: string) {
    return this.backupService.listBackups(clusterId);
  }

  @Post()
  @Roles('admin', 'operator')
  triggerBackup(@Param('clusterId') clusterId: string, @Request() req: any) {
    return this.backupService.triggerBackup(clusterId, 'MANUAL', req.user.id);
  }

  @Get('restores')
  @Roles('admin', 'operator', 'viewer')
  listRestores(@Param('clusterId') clusterId: string) {
    return this.backupService.listRestores(clusterId);
  }

  @Post(':backupId/restore')
  @Roles('admin', 'operator')
  requestRestore(
    @Param('clusterId') clusterId: string,
    @Param('backupId') backupId: string,
    @Body() body: { includeNamespaces?: string[]; excludeNamespaces?: string[] },
    @Request() req: any,
  ) {
    return this.backupService.requestRestore(backupId, req.user.id, body);
  }
}

@Controller('restores')
@UseGuards(AuthGuard, RolesGuard)
export class RestoreController {
  constructor(private readonly backupService: BackupService) {}

  @Post(':restoreId/approve')
  @Roles('admin')
  approveRestore(@Param('restoreId') restoreId: string, @Request() req: any) {
    return this.backupService.approveRestore(restoreId, req.user.id);
  }

  @Post(':restoreId/execute')
  @Roles('admin')
  executeRestore(@Param('restoreId') restoreId: string, @Request() req: any) {
    return this.backupService.executeRestore(restoreId, req.user.id);
  }
}
