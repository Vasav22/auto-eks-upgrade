import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AuditEventType } from '../enums/audit-event-type.enum';

@Entity('audit_records')
export class AuditRecord {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ type: 'varchar', length: 255 })
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

  @Column({ type: 'timestamptz', nullable: false, default: () => 'NOW()' })
  occurred_at!: Date;

  @BeforeInsert()
  setOccurredAt() {
    if (!this.occurred_at) this.occurred_at = new Date();
  }
}
