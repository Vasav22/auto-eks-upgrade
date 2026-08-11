import {
  Entity,
  PrimaryColumn,
  Column,
  ViewColumn,
} from 'typeorm';

@Entity('audit_records')
export class AuditRecord {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: false, name: 'actor_id' })
  actorId!: string;

  @Column({ type: 'varchar', nullable: false, name: 'actor_role' })
  actorRole!: string;

  @Column({ type: 'varchar', nullable: false })
  action!: string;

  @Column({ type: 'varchar', nullable: false, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'varchar', nullable: false, name: 'resource_id' })
  resourceId!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'change_detail' })
  changeDetail!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'approval_chain' })
  approvalChain!: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true, name: 'request_id' })
  requestId!: string | null;

  @PrimaryColumn({ type: 'timestamp with time zone', name: 'occurred_at' })
  occurredAt!: Date;
}
