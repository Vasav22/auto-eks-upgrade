import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Cluster } from './cluster.entity';
import { encrypt, decrypt } from '../encryption/column-encryption';

const encryptionKey = process.env['COLUMN_ENCRYPTION_KEY'] || '';

const encryptedTransformer = {
  to: (value: string): string => {
    if (!value) return value;
    return encrypt(value, encryptionKey);
  },
  from: (value: string): string => {
    if (!value) return value;
    return decrypt(value, encryptionKey);
  },
};

@Entity('cluster_accounts')
export class ClusterAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: false, name: 'aws_account_id' })
  awsAccountId!: string;

  @Column({
    type: 'varchar',
    nullable: false,
    name: 'role_arn',
    transformer: encryptedTransformer,
  })
  roleArn!: string;

  @Column({
    type: 'varchar',
    nullable: false,
    name: 'external_id',
    transformer: encryptedTransformer,
  })
  externalId!: string;

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
