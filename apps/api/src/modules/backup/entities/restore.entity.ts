import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';
import { BackupEntity } from './backup.entity';

@Entity('restores')
export class RestoreEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => BackupEntity) @JoinColumn({ name: 'backup_id' }) @Index() backup: BackupEntity;
  @ManyToOne(() => ClusterEntity) @JoinColumn({ name: 'cluster_id' }) @Index() cluster: ClusterEntity;
  @Column({ name: 'triggered_by', type: 'uuid' }) triggeredBy: string;
  @Column({ type: 'varchar', length: 32, default: 'PENDING_APPROVAL' }) @Index() status: string;
  @Column({ name: 'approval_status', type: 'varchar', length: 32, default: 'PENDING' }) approvalStatus: string;
  @Column({ name: 'approver_ids', type: 'jsonb', default: '[]' }) approverIds: string[];
  @Column({ name: 'include_namespaces', type: 'jsonb', default: '[]' }) includeNamespaces: string[];
  @Column({ name: 'exclude_namespaces', type: 'jsonb', default: '[]' }) excludeNamespaces: string[];
  @Column({ name: 'velero_restore_name', type: 'varchar', length: 255, nullable: true }) veleroRestoreName?: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) phase?: string;
  @Column({ name: 'resource_outcomes', type: 'jsonb', default: '[]' }) resourceOutcomes: any[];
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage?: string;
  @Column({ name: 'post_restore_health_check_id', type: 'uuid', nullable: true }) postRestoreHealthCheckId?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
