import { Controller, Get, Post, Query, Body, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import { AuditService } from '../services/audit.service';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { AuditEventDto } from '../dto/audit-event.dto';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { ROLES } from '../../../auth/constants/roles';

@Controller('api/v1/audit')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(
    private auditService: AuditService,
    @InjectQueue('audit-export') private exportQueue: Queue,
  ) {}

  @Get()
  @Roles(ROLES.COMPLIANCE_REVIEWER)
  async queryAuditRecords(@Query() query: AuditQueryDto) {
    const result = await this.auditService.query(query);
    return {
      records: result.records,
      total: result.total,
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
    };
  }

  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(ROLES.COMPLIANCE_REVIEWER)
  async exportAuditRecords(@Body() query: AuditQueryDto) {
    const jobId = crypto.randomUUID();

    await this.exportQueue.add('export-audit', {
      jobId,
      filters: query,
      requestedAt: new Date().toISOString(),
    });

    // Record the export request as an audit event
    const exportEventDto: AuditEventDto = {
      actorId: 'system', // TODO: Extract from authenticated user
      actorRole: 'compliance_reviewer',
      action: AuditEventType.EXPORT_REQUESTED,
      resourceType: 'audit_export',
      resourceId: jobId,
      changeDetail: {
        filters: query,
      },
    };

    await this.auditService.record(exportEventDto);

    this.logger.log(`Export job ${jobId} queued`);
    return {
      jobId,
      status: 'queued',
      message: 'Export job submitted. Results will be available in S3.',
    };
  }
}
