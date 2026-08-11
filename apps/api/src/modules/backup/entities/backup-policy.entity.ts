import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

@Entity('backup_policies')
export class BackupPolicyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ClusterEntity) @JoinColumn({ name: 'cluster_id' }) cluster: ClusterEntity;
  @Column({ type: 'varchar', length: 128 }) name: string;
  @Column({ name: 'schedule_cron', type: 'varchar', length: 64, default: '0 2 * * *' }) scheduleCron: string;
  @Column({ name: 'retention_days', type: 'integer', default: 30 }) retentionDays: number;
  @Column({ name: 'include_namespaces', type: 'jsonb', default: '[]' }) includeNamespaces: string[];
  @Column({ name: 'exclude_namespaces', type: 'jsonb', default: '["kube-system"]' }) excludeNamespaces: string[];
  @Column({ name: 'storage_location', type: 'varchar', length: 255, nullable: true }) storageLocation?: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
