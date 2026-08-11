import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';
import { BackupPolicyEntity } from './backup-policy.entity';

@Entity('backups')
export class BackupEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ClusterEntity) @JoinColumn({ name: 'cluster_id' }) @Index() cluster: ClusterEntity;
  @ManyToOne(() => BackupPolicyEntity, { nullable: true }) @JoinColumn({ name: 'policy_id' }) policy?: BackupPolicyEntity;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 32, default: 'SCHEDULED' }) trigger: string;
  @Column({ type: 'varchar', length: 32, default: 'PENDING' }) @Index() status: string;
  @Column({ name: 'velero_backup_name', type: 'varchar', length: 255, nullable: true }) veleroBackupName?: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) phase?: string;
  @Column({ name: 'included_namespaces', type: 'jsonb', default: '[]' }) includedNamespaces: string[];
  @Column({ name: 'resource_count', type: 'integer', default: 0 }) resourceCount: number;
  @Column({ name: 'size_bytes', type: 'bigint', default: 0 }) sizeBytes: number;
  @Column({ name: 'storage_location', type: 'varchar', length: 255, nullable: true }) storageLocation?: string;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt?: Date;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
