import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

@Entity('campaign_targets')
export class CampaignTargetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => CampaignEntity, (c) => c.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' }) campaign: CampaignEntity;
  @ManyToOne(() => ClusterEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cluster_id' }) cluster: ClusterEntity;
  @Column({ type: 'varchar', length: 32, default: 'PENDING' }) @Index() status: string;
  @Column({ name: 'upgrade_job_id', type: 'uuid', nullable: true }) upgradeJobId?: string;
  @Column({ name: 'eligibility_checked_at', type: 'timestamptz', nullable: true }) eligibilityCheckedAt?: Date;
  @Column({ name: 'eligibility_pass', type: 'boolean', nullable: true }) eligibilityPass?: boolean;
  @Column({ name: 'eligibility_reasons', type: 'jsonb', default: '[]' }) eligibilityReasons: string[];
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage?: string;
  @Column({ name: 'sort_order', type: 'integer', nullable: true }) sortOrder?: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
