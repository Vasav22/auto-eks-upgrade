import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('remediation_proposals')
export class RemediationProposalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'health_check_id', type: 'uuid' }) @Index() healthCheckId: string;
  @Column({ name: 'cluster_id', type: 'uuid' }) @Index() clusterId: string;
  @Column({ name: 'finding_category', type: 'varchar', length: 64 }) findingCategory: string;
  @Column({ name: 'finding_title', type: 'varchar', length: 255 }) findingTitle: string;
  @Column({ type: 'varchar', length: 16 }) severity: string;
  @Column({ name: 'proposed_action', type: 'varchar', length: 64 }) proposedAction: string;
  @Column({ type: 'text' }) description: string;
  @Column({ name: 'risk_level', type: 'varchar', length: 16, default: 'LOW' }) riskLevel: string;
  @Column({ name: 'requires_approval', type: 'boolean', default: true }) requiresApproval: boolean;
  @Column({ name: 'auto_approved', type: 'boolean', default: false }) autoApproved: boolean;
  @Column({ type: 'varchar', length: 32, default: 'PENDING' }) @Index() status: string;
  @Column({ name: 'approver_ids', type: 'jsonb', default: '[]' }) approverIds: string[];
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt?: Date;
  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true }) rejectedAt?: Date;
  @Column({ name: 'rejection_reason', type: 'text', nullable: true }) rejectionReason?: string;
  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true }) executedAt?: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'execution_output', type: 'jsonb', default: '{}' }) executionOutput: Record<string, unknown>;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, nullable: true }) idempotencyKey?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
