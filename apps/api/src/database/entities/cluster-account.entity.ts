import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Cluster } from './cluster.entity';

@Entity('cluster_accounts')
export class ClusterAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: false, name: 'account_name' })
  accountName!: string;

  @Column({ type: 'text', nullable: true, name: 'encrypted_credentials' })
  encryptedCredentials!: string;

  @Column({ type: 'varchar', nullable: true, name: 'credentials_nonce' })
  credentialsNonce!: string;

  @Column({ type: 'varchar', nullable: true, name: 'credentials_tag' })
  credentialsTag!: string;

  @Column({ type: 'varchar', nullable: true, name: 'default_region', default: 'us-east-1' })
  defaultRegion!: string;

  @Column({ type: 'varchar', nullable: true, name: 'aws_account_id' })
  awsAccountId!: string | null;

  @Column({ type: 'varchar', nullable: false, default: 'active' })
  status!: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_assumed_at' })
  lastAssumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Cluster, (cluster) => cluster.account)
  clusters!: Cluster[];
}

export { ClusterAccount as ClusterAccountEntity };
