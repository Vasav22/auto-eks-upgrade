import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

@Entity('node_groups')
@Index(['cluster', 'name'], { unique: true })
export class NodeGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClusterEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cluster_id' })
  cluster: ClusterEntity;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'node_group_name', type: 'varchar', length: 255 })
  nodeGroupName: string;

  @Column({ name: 'ami_type', type: 'varchar', length: 64, nullable: true })
  amiType?: string;

  @Column({ name: 'instance_types', type: 'jsonb', default: '[]' })
  instanceTypes: string[];

  @Column({ name: 'current_version', type: 'varchar', length: 16 })
  currentVersion: string;

  @Column({ name: 'target_version', type: 'varchar', length: 16, nullable: true })
  targetVersion?: string;

  @Column({ name: 'min_size', type: 'integer', default: 1 })
  minSize: number;

  @Column({ name: 'max_size', type: 'integer', default: 10 })
  maxSize: number;

  @Column({ name: 'desired_size', type: 'integer', default: 1 })
  desiredSize: number;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  @Index()
  status: string;

  @Column({ type: 'jsonb', default: '{}' })
  labels: Record<string, string>;

  @Column({ type: 'jsonb', default: '[]' })
  taints: Array<{ key: string; value?: string; effect: string }>;

  @Column({ type: 'jsonb', default: '{}' })
  tags: Record<string, string>;

  @Column({ name: 'launch_template_id', type: 'varchar', length: 64, nullable: true })
  launchTemplateId?: string;

  @Column({ name: 'launch_template_version', type: 'varchar', length: 16, nullable: true })
  launchTemplateVersion?: string;

  @Column({ name: 'disk_size_gb', type: 'integer', nullable: true })
  diskSizeGb?: number;

  @Column({ type: 'jsonb', default: '[]' })
  subnets: string[];

  @Column({ name: 'capacity_type', type: 'varchar', length: 16, default: 'ON_DEMAND' })
  capacityType: string;

  @Column({ name: 'upgrade_order', type: 'integer', nullable: true })
  upgradeOrder?: number;

  @Column({ name: 'upgrade_strategy', type: 'varchar', length: 32, default: 'ROLLING' })
  upgradeStrategy: string;

  @Column({ name: 'max_unavailable', type: 'integer', nullable: true })
  maxUnavailable?: number;

  @Column({ name: 'max_unavailable_percentage', type: 'integer', nullable: true })
  maxUnavailablePercentage?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date;
}
