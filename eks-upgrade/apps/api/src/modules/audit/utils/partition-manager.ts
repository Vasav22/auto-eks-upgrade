import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PartitionManager {
  private readonly logger = new Logger(PartitionManager.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async createMonthlyPartition(year: number, month: number): Promise<void> {
    const partitionName = `audit_records_y${year}m${month.toString().padStart(2, '0')}`;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    
    // Calculate next month for upper bound
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    const query = `
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF audit_records
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `;

    try {
      await this.dataSource.query(query);
      this.logger.log(`Created partition ${partitionName}`);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '42P07') {
        this.logger.debug(`Partition ${partitionName} already exists`);
      } else {
        this.logger.error(`Failed to create partition ${partitionName}: ${(error as Error).message}`);
        throw error;
      }
    }
  }

  async ensureFuturePartitions(monthsAhead: number = 3): Promise<void> {
    const now = new Date();
    
    for (let i = 0; i <= monthsAhead; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      await this.createMonthlyPartition(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
      );
    }

    this.logger.log(`Ensured ${monthsAhead + 1} future partitions exist`);
  }
}
