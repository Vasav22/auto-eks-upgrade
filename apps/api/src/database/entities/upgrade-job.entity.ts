import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cluster } from './cluster.entity';
import { User } from './user.entity';

@Entity('upgrade_jobs')
export class UpgradeJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'cluster_id' })
  clusterId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'node_group_id' })
  nodeGroupId!: string | null;

  @Column({ type: 'varchar', nullable: false, name: 'job_type' })
  jobType!: string;

  @Column({ type: 'varchar', nullable: false, name: 'from_version' })
  fromVersion!: string;

  @Column({ type: 'varchar', nullable: false, name: 'to_version' })
  toVersion!: string;

  @Column({ type: 'varchar', nullable: false, default: 'pending' })
  status!: string;

  @Column({ type: 'varchar', nullable: true, name: 'aws_update_id' })
  awsUpdateId!: string | null;

  @Column({ type: 'uuid', nullable: false, name: 'initiated_by' })
  initiatedBy!: string;

  @Column({ type: 'uuid', nullable: true, name: 'campaign_id' })
  campaignId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'backup_id' })
  backupId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'dry_run_id' })
  dryRunId!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'error_detail' })
  errorDetail!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Cluster)
  @JoinColumn({ name: 'cluster_id' })
  cluster!: Cluster;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'initiated_by' })
  initiatedByUser!: User;
}
