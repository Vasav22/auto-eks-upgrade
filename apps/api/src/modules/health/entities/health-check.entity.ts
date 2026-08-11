import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

@Entity('health_checks')
export class HealthCheckEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ClusterEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'cluster_id' }) cluster: ClusterEntity;
  @Column({ name: 'upgrade_job_id', type: 'uuid', nullable: true }) upgradeJobId?: string;
  @Column({ type: 'varchar', length: 32, default: 'MANUAL' }) @Index() trigger: string;
  @Column({ type: 'varchar', length: 32, default: 'RUNNING' }) @Index() status: string;
  @Column({ name: 'overall_health', type: 'varchar', length: 32, nullable: true }) overallHealth?: string;
  @Column({ name: 'total_findings', type: 'integer', default: 0 }) totalFindings: number;
  @Column({ name: 'critical_count', type: 'integer', default: 0 }) criticalCount: number;
  @Column({ name: 'high_count', type: 'integer', default: 0 }) highCount: number;
  @Column({ name: 'warning_count', type: 'integer', default: 0 }) warningCount: number;
  @Column({ type: 'jsonb', default: '[]' }) findings: any[];
  @Column({ name: 'node_summary', type: 'jsonb', nullable: true }) nodeSummary?: Record<string, number>;
  @Column({ name: 'pod_summary', type: 'jsonb', nullable: true }) podSummary?: Record<string, number>;
  @Column({ name: 'pdb_summary', type: 'jsonb', nullable: true }) pdbSummary?: Record<string, number>;
  @Column({ name: 'agent_endpoint', type: 'varchar', length: 255, nullable: true }) agentEndpoint?: string;
  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' }) startedAt: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt?: Date;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage?: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
