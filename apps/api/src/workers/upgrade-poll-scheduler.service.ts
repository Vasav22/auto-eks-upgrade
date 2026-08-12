import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UpgradeJobEntity } from '../database/entities/upgrade-job.entity';
import { UpgradePollJobData } from './upgrade-poll.worker';

const POLL_CRON = '*/1 * * * *'; // every minute

@Injectable()
export class UpgradePollSchedulerService {
  private readonly logger = new Logger(UpgradePollSchedulerService.name);
  private readonly MAX_POLL_COUNT = 240; // 2 hours total

  constructor(
    @InjectQueue('upgrade-poll') private readonly pollQueue: Queue,
    @InjectRepository(UpgradeJobEntity)
    private readonly upgradeRepository: Repository<UpgradeJobEntity>,
  ) {}

  @Cron(POLL_CRON)
  async pollActiveUpgrades(): Promise<void> {
    const activeUpgrades = await this.upgradeRepository.find({
      where: { status: In(['IN_PROGRESS', 'PENDING']) as any },
      relations: ['cluster'],
      take: 50,
    });

    if (activeUpgrades.length === 0) return;

    this.logger.log(`Scheduling polls for ${activeUpgrades.length} active upgrades`);

    for (const upgrade of activeUpgrades) {
      const existingJobs = await this.pollQueue.getJobs(['active', 'waiting']);
      const alreadyQueued = existingJobs.some(
        (j) => j.data?.upgradeJobId === upgrade.id,
      );

      if (alreadyQueued) continue;

      const pollCount = await this.getPollCount(upgrade.id);
      if (pollCount >= this.MAX_POLL_COUNT) {
        this.logger.warn(`Upgrade ${upgrade.id} exceeded max poll count, stopping`);
        continue;
      }

      const jobData: UpgradePollJobData = {
        upgradeJobId: upgrade.id,
        clusterId: upgrade.cluster.id,
        targetVersion: upgrade.targetVersion,
        pollCount: pollCount + 1,
      };

      await this.pollQueue.add(`poll-${upgrade.id}`, jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { age: 86400 },
      });
    }
  }

  async startPolling(upgradeJobId: string, clusterId: string, targetVersion: string): Promise<void> {
    const jobData: UpgradePollJobData = {
      upgradeJobId,
      clusterId,
      targetVersion,
      pollCount: 1,
    };

    await this.pollQueue.add(`poll-${upgradeJobId}-initial`, jobData, {
      delay: 10000, // Wait 10s before first poll
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { age: 86400 },
    });

    this.logger.log(`Started polling for upgrade ${upgradeJobId}`);
  }

  private async getPollCount(upgradeJobId: string): Promise<number> {
    const completed = await this.pollQueue.getJobCounts('completed');
    return completed['completed'] || 0;
  }
}
