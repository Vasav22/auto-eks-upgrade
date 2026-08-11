import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Cluster as ClusterEntity } from '../../../database/entities/cluster.entity';

@Entity('upgrade_schedules')
export class UpgradeScheduleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ClusterEntity) @JoinColumn({ name: 'cluster_id' }) @Index() cluster: ClusterEntity;
  @Column({ name: 'target_version', type: 'varchar', length: 16 }) targetVersion: string;
  @Column({ name: 'scheduled_at', type: 'timestamptz' }) @Index() scheduledAt: Date;
  @Column({ name: 'cron_expression', type: 'varchar', length: 64, nullable: true }) cronExpression?: string;
  @Column({ type: 'varchar', length: 32, default: 'SCHEDULED' }) @Index() status: string;
  @Column({ name: 'dry_run', type: 'boolean', default: false }) dryRun: boolean;
  @Column({ name: 'max_retries', type: 'integer', default: 1 }) maxRetries: number;
  @Column({ name: 'retry_count', type: 'integer', default: 0 }) retryCount: number;
  @Column({ name: 'upgrade_job_id', type: 'uuid', nullable: true }) upgradeJobId?: string;
  @Column({ name: 'pre_validation_passed', type: 'boolean', nullable: true }) preValidationPassed?: boolean;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @Column({ type: 'text', nullable: true }) notes?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
