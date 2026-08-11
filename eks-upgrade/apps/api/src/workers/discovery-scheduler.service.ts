import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClusterService } from '../modules/clusters/services/cluster.service';
import { DiscoveryJobData } from './discovery.worker';

@Injectable()
export class DiscoverySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DiscoverySchedulerService.name);
  private readonly SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectQueue('discovery') private readonly discoveryQueue: Queue,
    private readonly clusterService: ClusterService,
  ) {}

  async onModuleInit() {
    this.logger.log('DiscoverySchedulerService initialized');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledDiscovery() {
    this.logger.log('Starting scheduled cluster discovery');

    try {
      const accounts = await this.clusterService.listAccounts();

      if (accounts.length === 0) {
        this.logger.log('No accounts registered, skipping discovery');
        return;
      }

      const jobs: Promise<any>[] = [];

      for (const account of accounts) {
        const jobData: DiscoveryJobData = {
          accountId: account.id,
          triggeredBy: this.SYSTEM_ACTOR_ID,
        };

        const jobPromise = this.discoveryQueue
          .add(`discover-${account.accountName}`, jobData, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: {
              age: 86400,
              count: 100,
            },
            removeOnFail: {
              age: 259200,
              count: 500,
            },
          })
          .then((job) => {
            this.logger.log(
              `Scheduled discovery job ${job.id} for account ${account.accountName}`,
            );
            return job;
          })
          .catch((error) => {
            this.logger.error(
              `Failed to schedule discovery for account ${account.accountName}: ${error.message}`,
            );
            return null;
          });

        jobs.push(jobPromise);
      }

      const results = await Promise.allSettled(jobs);

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value !== null,
      ).length;
      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null),
      ).length;

      this.logger.log(
        `Scheduled discovery completed: ${successful} successful, ${failed} failed out of ${accounts.length} accounts`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async triggerDiscoveryForAccount(
    accountId: string,
    triggeredBy: string,
    regions?: string[],
  ): Promise<string> {
    const account = await this.clusterService.getAccountById(accountId);

    const jobData: DiscoveryJobData = {
      accountId,
      regions,
      triggeredBy,
    };

    const job = await this.discoveryQueue.add(
      `discover-${account.accountName}-manual`,
      jobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400,
          count: 100,
        },
        removeOnFail: {
          age: 259200,
          count: 500,
        },
      },
    );

    this.logger.log(
      `Manually triggered discovery job ${job.id} for account ${account.accountName}`,
    );

    return job.id;
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.discoveryQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      result: returnValue,
      error: failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }
}
