import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NotificationEntity } from './notification.entity';

@Entity('notification_channels')
export class NotificationChannelEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 128 }) name: string;
  @Column({ type: 'varchar', length: 32 }) type: string;
  @Column({ type: 'jsonb', default: '{}' }) config: Record<string, unknown>;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ name: 'events', type: 'jsonb', default: '[]' }) subscribedEvents: string[];
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @OneToMany(() => NotificationEntity, (n) => n.channel) notifications: NotificationEntity[];
}
