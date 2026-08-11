import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AuditService } from '../services/audit.service';

@Processor('audit-export')
export class AuditExportWorker extends WorkerHost {
  private readonly logger = new Logger(AuditExportWorker.name);

  constructor(private auditService: AuditService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { jobId, filters } = job.data;
    this.logger.log(`Processing export job ${jobId}`);

    try {
      // Query audit records with filters
      const result = await this.auditService.query({
        ...filters,
        limit: 10000, // Large batch for export
        offset: 0,
      });

      // TODO: Upload to S3 as newline-delimited JSON
      // const s3Key = `audit-exports/${jobId}.ndjson`;
      // await uploadToS3(result.records, s3Key);

      this.logger.log(
        `Export job ${jobId} completed: ${result.records.length} records`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Export job ${jobId} failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
