import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { CampaignTargetEntity } from './campaign-target.entity';

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ name: 'target_version', type: 'varchar', length: 16 }) targetVersion: string;
  @Column({ type: 'varchar', length: 32, default: 'DRAFT' }) @Index() status: string;
  @Column({ name: 'dry_run', type: 'boolean', default: false }) dryRun: boolean;
  @Column({ name: 'schedule_cron', type: 'varchar', length: 64, nullable: true }) scheduleCron?: string;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true }) scheduledAt?: Date;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'max_parallel', type: 'integer', default: 1 }) maxParallel: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @Column({ type: 'jsonb', default: '{}' }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @OneToMany(() => CampaignTargetEntity, (t) => t.campaign) targets: CampaignTargetEntity[];
}
