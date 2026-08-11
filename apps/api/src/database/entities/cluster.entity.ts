import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ClusterAccount } from './cluster-account.entity';

@Entity('clusters')
@Unique(['name', 'accountId'])
export class Cluster {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({ type: 'uuid', nullable: false, name: 'account_id' })
  accountId!: string;

  @Column({ type: 'varchar', nullable: false })
  region!: string;

  @Column({ type: 'varchar', nullable: false, name: 'current_version' })
  currentVersion!: string;

  @Column({ type: 'varchar', nullable: false, default: 'discovered' })
  status!: string;

  @Column({ type: 'varchar', nullable: false, name: 'environment_tag' })
  environmentTag!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'discovery_metadata' })
  discoveryMetadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'last_discovered_at' })
  lastDiscoveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => ClusterAccount, (account) => account.clusters)
  @JoinColumn({ name: 'account_id' })
  account!: ClusterAccount;
}
