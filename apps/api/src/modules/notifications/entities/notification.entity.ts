import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { NotificationChannelEntity } from './notification-channel.entity';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => NotificationChannelEntity, (c) => c.notifications) @JoinColumn({ name: 'channel_id' }) channel: NotificationChannelEntity;
  @Column({ name: 'event_type', type: 'varchar', length: 64 }) eventType: string;
  @Column({ type: 'varchar', length: 255 }) subject: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'varchar', length: 32, default: 'PENDING' }) @Index() status: string;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt?: Date;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage?: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
