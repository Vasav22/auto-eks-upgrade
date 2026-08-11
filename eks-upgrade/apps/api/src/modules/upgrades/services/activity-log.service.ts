import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpgradeEventEntity } from '../../../database/entities/upgrade-event.entity';
import { UpgradeJobEntity } from '../../../database/entities/upgrade-job.entity';

export interface ActivityLogEntry {
  id: string;
  upgradeJobId: string;
  eventType: string;
  eventData: any;
  timestamp: Date;
  sequenceNumber: number;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(UpgradeEventEntity)
    private readonly eventRepository: Repository<UpgradeEventEntity>,
  ) {}

  async logActivity(
    upgradeJob: UpgradeJobEntity,
    eventType: string,
    eventData: any,
  ): Promise<UpgradeEventEntity> {
    // Get the next sequence number
    const lastEvent = await this.eventRepository.findOne({
      where: { upgradeJob: { id: upgradeJob.id } },
      order: { sequenceNumber: 'DESC' },
    });

    const sequenceNumber = lastEvent ? lastEvent.sequenceNumber + 1 : 1;

    const event = this.eventRepository.create({
      upgradeJob,
      eventType,
      eventData,
      sequenceNumber,
    });

    const savedEvent = await this.eventRepository.save(event);

    this.logger.debug(
      `Logged activity for upgrade ${upgradeJob.id}: ${eventType} (seq: ${sequenceNumber})`,
    );

    return savedEvent;
  }

  async getActivityLog(
    upgradeJobId: string,
    fromSequence?: number,
  ): Promise<UpgradeEventEntity[]> {
    const query = this.eventRepository
      .createQueryBuilder('event')
      .where('event.upgradeJobId = :upgradeJobId', { upgradeJobId })
      .orderBy('event.sequenceNumber', 'ASC');

    if (fromSequence !== undefined) {
      query.andWhere('event.sequenceNumber > :fromSequence', { fromSequence });
    }

    return query.getMany();
  }

  async getLatestSequence(upgradeJobId: string): Promise<number> {
    const lastEvent = await this.eventRepository.findOne({
      where: { upgradeJob: { id: upgradeJobId } },
      order: { sequenceNumber: 'DESC' },
    });

    return lastEvent ? lastEvent.sequenceNumber : 0;
  }

  async detectGap(
    upgradeJobId: string,
    clientLastSequence: number,
  ): Promise<{ hasGap: boolean; missingEvents: UpgradeEventEntity[] }> {
    const latestSequence = await this.getLatestSequence(upgradeJobId);

    if (clientLastSequence >= latestSequence) {
      return { hasGap: false, missingEvents: [] };
    }

    const missingEvents = await this.getActivityLog(
      upgradeJobId,
      clientLastSequence,
    );

    // Check for actual sequence gaps (not just newer events)
    const expectedCount = latestSequence - clientLastSequence;
    const hasGap = missingEvents.length !== expectedCount;

    if (hasGap) {
      this.logger.warn(
        `Gap detected in upgrade ${upgradeJobId}: expected ${expectedCount} events, found ${missingEvents.length}`,
      );
    }

    return {
      hasGap: missingEvents.length > 0,
      missingEvents,
    };
  }

  async getEventById(eventId: string): Promise<UpgradeEventEntity | null> {
    return this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['upgradeJob'],
    });
  }

  async countEventsForJob(upgradeJobId: string): Promise<number> {
    return this.eventRepository.count({
      where: { upgradeJob: { id: upgradeJobId } },
    });
  }
}
