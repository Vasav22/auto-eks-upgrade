import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ClusterAccount } from './cluster-account.entity';

@Entity('clusters')
@Unique(['clusterName', 'accountId', 'region'])
export class Cluster {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', nullable: false, name: 'cluster_name' })
  clusterName!: string;

  @Column({ type: 'varchar', nullable: true, name: 'cluster_arn' })
  clusterArn!: string;

  @Column({ type: 'uuid', nullable: true, name: 'account_id' })
  accountId!: string;

  @Column({ type: 'varchar', nullable: false })
  region!: string;

  @Column({ type: 'varchar', nullable: true, name: 'eks_version' })
  currentVersion!: string;

  @Column({ type: 'varchar', nullable: false, default: 'discovered' })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  endpoint!: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'environment_tag' })
  environmentTag!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'discovery_metadata' })
  discoveryMetadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_synced_at' })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClusterAccount, (account) => account.clusters)
  @JoinColumn({ name: 'account_id' })
  account!: ClusterAccount;
}

export { Cluster as ClusterEntity };
