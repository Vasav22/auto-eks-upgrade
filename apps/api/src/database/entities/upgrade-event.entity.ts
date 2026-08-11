import {
  Entity,
  PrimaryColumn,
  Column,
} from 'typeorm';

@Entity('upgrade_events')
export class UpgradeEvent {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'job_id' })
  jobId!: string;

  @Column({ type: 'varchar', nullable: false, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'text', nullable: false })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @PrimaryColumn({ type: 'timestamp with time zone', name: 'occurred_at' })
  occurredAt!: Date;
}
