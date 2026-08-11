import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationChannelEntity } from '../entities/notification-channel.entity';
import { NotificationEntity } from '../entities/notification.entity';

type EventType = 
  | 'upgrade_completed' | 'upgrade_failed' | 'upgrade_stalled'
  | 'remediation_proposal' | 'backup_failed' | 'health_critical'
  | 'campaign_completed' | 'restore_approved';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationChannelEntity)
    private readonly channelRepository: Repository<NotificationChannelEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async dispatch(eventType: EventType, subject: string, body: string, metadata?: Record<string, unknown>): Promise<void> {
    const channels = await this.channelRepository.find({
      where: { enabled: true },
    });

    const relevantChannels = channels.filter((c) => {
      const events: string[] = c.subscribedEvents ?? [];
      return events.length === 0 || events.includes(eventType);
    });

    for (const channel of relevantChannels) {
      const notification = this.notificationRepository.create({
        channel: { id: channel.id } as any,
        eventType,
        subject,
        body,
        status: 'PENDING',
        metadata: metadata ?? {},
      });

      const saved = await this.notificationRepository.save(notification);
      await this.sendNotification(saved, channel);
    }
  }

  private async sendNotification(notification: NotificationEntity, channel: NotificationChannelEntity): Promise<void> {
    try {
      switch (channel.type) {
        case 'SLACK':
          await this.sendSlack(notification, channel.config);
          break;
        case 'WEBHOOK':
          await this.sendWebhook(notification, channel.config);
          break;
        default:
          this.logger.warn(`Unsupported channel type: ${channel.type}`);
      }

      notification.status = 'SENT';
      notification.sentAt = new Date();
      await this.notificationRepository.save(notification);
    } catch (err) {
      notification.status = 'FAILED';
      notification.errorMessage = err instanceof Error ? err.message : String(err);
      await this.notificationRepository.save(notification);
    }
  }

  private async sendSlack(notification: NotificationEntity, config: Record<string, unknown>): Promise<void> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) throw new Error('Slack webhookUrl not configured');

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${notification.subject}*\n${notification.body}`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  }

  private async sendWebhook(notification: NotificationEntity, config: Record<string, unknown>): Promise<void> {
    const url = config.url as string;
    if (!url) throw new Error('Webhook URL not configured');

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.headers as Record<string, string> ?? {}) },
      body: JSON.stringify({ subject: notification.subject, body: notification.body, metadata: notification.metadata }),
      signal: AbortSignal.timeout(10000),
    });
  }

  async createChannel(dto: Partial<NotificationChannelEntity>, actorId: string): Promise<NotificationChannelEntity> {
    const channel = this.channelRepository.create({ ...dto, createdBy: actorId });
    return this.channelRepository.save(channel);
  }

  async listChannels(): Promise<NotificationChannelEntity[]> {
    return this.channelRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getNotificationHistory(limit = 50): Promise<NotificationEntity[]> {
    return this.notificationRepository.find({
      relations: ['channel'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
