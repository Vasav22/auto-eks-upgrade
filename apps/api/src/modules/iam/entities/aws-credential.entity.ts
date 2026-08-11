import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('aws_credentials')
@Index(['accountId'], { unique: true })
export class AwsCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', length: 20 })
  accountId: string;

  @Column({ name: 'account_alias', length: 128, nullable: true })
  accountAlias?: string;

  @Column({ name: 'role_arn', length: 256 })
  roleArn: string;

  @Column({ name: 'external_id', length: 128, nullable: true })
  externalId?: string;

  @Column({ name: 'last_assumed_at', type: 'timestamptz', nullable: true })
  lastAssumedAt?: Date;

  @Column({ name: 'last_rotated_at', type: 'timestamptz', nullable: true })
  lastRotatedAt?: Date;

  @Column({ name: 'rotation_interval_days', default: 90 })
  rotationIntervalDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'validation_status', length: 32, default: 'UNKNOWN' })
  validationStatus: 'VALID' | 'INVALID' | 'UNKNOWN';

  @Column({ name: 'validation_message', type: 'text', nullable: true })
  validationMessage?: string;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
