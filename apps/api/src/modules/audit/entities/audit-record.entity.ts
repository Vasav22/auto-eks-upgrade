import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { AuditEventType } from '../enums/audit-event-type.enum';

@Entity('audit_records')
export class AuditRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  actor_id!: string;

  @Column({ type: 'varchar', length: 50 })
  actor_role!: string;

  @Column({ type: 'enum', enum: AuditEventType })
  action!: AuditEventType;

  @Column({ type: 'varchar', length: 100 })
  resource_type!: string;

  @Column({ type: 'varchar', length: 255 })
  resource_id!: string;

  @Column({ type: 'jsonb' })
  change_detail!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  approval_chain!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  request_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurred_at!: Date;
}
