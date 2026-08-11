import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RemediationProposalEntity } from '../entities/remediation-proposal.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { UpgradeEventsGateway } from '../../../gateways/upgrade-events.gateway';
import { HealthService } from '../../health/services/health.service';

export interface RemediationAction {
  type: 'RESTART_POD' | 'DRAIN_NODE' | 'CORDON_NODE' | 'DELETE_POD' | 'SCALE_DEPLOYMENT';
  targetResource: string;
  targetNamespace?: string;
  parameters?: Record<string, unknown>;
}

@Injectable()
export class RemediationService {
  private readonly logger = new Logger(RemediationService.name);
  private readonly RATE_LIMIT_PER_HOUR = 10;
  private readonly recentExecutions = new Map<string, number[]>();

  constructor(
    @InjectRepository(RemediationProposalEntity)
    private readonly proposalRepository: Repository<RemediationProposalEntity>,
    private readonly auditService: AuditService,
    private readonly eventsGateway: UpgradeEventsGateway,
    private readonly healthService: HealthService,
  ) {}

  async generateProposals(healthCheckId: string, actorId: string): Promise<RemediationProposalEntity[]> {
    const healthCheck = await this.healthService['healthCheckRepository'].findOne({
      where: { id: healthCheckId },
    });

    if (!healthCheck) throw new NotFoundException(`Health check ${healthCheckId} not found`);

    const proposals: Partial<RemediationProposalEntity>[] = [];

    for (const finding of healthCheck.findings) {
      const proposal = this.mapFindingToProposal(healthCheckId, healthCheck.cluster?.id, finding);
      if (proposal) proposals.push(proposal);
    }

    const saved = await this.proposalRepository.save(
      proposals.map((p) => this.proposalRepository.create(p)),
    );

    await this.eventsGateway.emitUpgradeEvent(healthCheck.cluster?.id ?? healthCheckId, 'remediation_proposals_ready', {
      count: saved.length,
      healthCheckId,
    });

    return saved;
  }

  private mapFindingToProposal(
    healthCheckId: string,
    clusterId: string,
    finding: Record<string, any>,
  ): Partial<RemediationProposalEntity> | null {
    const base = {
      healthCheckId,
      clusterId,
      findingCategory: finding.category,
      findingTitle: finding.title,
      severity: finding.severity,
      requiresApproval: true,
      status: 'PENDING',
    };

    if (finding.category === 'pod_health' && finding.title === 'CrashLoopBackOff') {
      return {
        ...base,
        proposedAction: 'RESTART_POD',
        description: `Restart pod ${finding.resource} in ${finding.namespace} to clear CrashLoopBackOff`,
        riskLevel: 'LOW',
      };
    }

    if (finding.category === 'node_health') {
      return {
        ...base,
        proposedAction: 'CORDON_NODE',
        description: `Cordon node ${finding.resource} to prevent new pod scheduling`,
        riskLevel: 'MEDIUM',
      };
    }

    if (finding.category === 'disruption_policy') {
      return {
        ...base,
        proposedAction: 'REVIEW_PDB',
        description: `Review and update PodDisruptionBudget ${finding.resource} in ${finding.namespace}`,
        riskLevel: 'LOW',
        requiresApproval: false,
        autoApproved: true,
      };
    }

    return null;
  }

  async approveProposal(proposalId: string, actorId: string): Promise<RemediationProposalEntity> {
    const proposal = await this.proposalRepository.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);
    if (proposal.status !== 'PENDING') {
      throw new BadRequestException(`Proposal is already ${proposal.status}`);
    }

    const approverIds: string[] = proposal.approverIds ?? [];
    if (approverIds.includes(actorId)) {
      throw new BadRequestException('You have already approved this proposal');
    }

    approverIds.push(actorId);
    proposal.approverIds = approverIds;

    // Require 2 approvers for high/critical risk
    const requiredApprovals = ['HIGH', 'CRITICAL'].includes(proposal.riskLevel.toUpperCase()) ? 2 : 1;
    if (approverIds.length >= requiredApprovals) {
      proposal.status = 'APPROVED';
      proposal.approvedAt = new Date();
    }

    const saved = await this.proposalRepository.save(proposal);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'remediation_proposal',
      targetId: proposalId,
      metadata: { event: 'proposal_approved', approverCount: approverIds.length, requiredApprovals },
    });

    return saved;
  }

  async rejectProposal(
    proposalId: string,
    reason: string,
    actorId: string,
  ): Promise<RemediationProposalEntity> {
    const proposal = await this.proposalRepository.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);

    proposal.status = 'REJECTED';
    proposal.rejectedAt = new Date();
    proposal.rejectionReason = reason;

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'remediation_proposal',
      targetId: proposalId,
      metadata: { event: 'proposal_rejected', reason },
    });

    return this.proposalRepository.save(proposal);
  }

  async executeApprovedProposal(proposalId: string, actorId: string): Promise<RemediationProposalEntity> {
    const proposal = await this.proposalRepository.findOne({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);
    if (proposal.status !== 'APPROVED' && !proposal.autoApproved) {
      throw new ForbiddenException('Proposal must be approved before execution');
    }

    // Rate limit check
    if (this.isRateLimited(actorId)) {
      throw new BadRequestException(`Rate limit exceeded: max ${this.RATE_LIMIT_PER_HOUR} remediations per hour`);
    }

    proposal.status = 'EXECUTING';
    proposal.executedAt = new Date();
    await this.proposalRepository.save(proposal);

    this.recordExecution(actorId);

    // Actual execution would call the cluster's kubectl API or health agent
    // For now we mark it complete after simulated execution
    proposal.status = 'COMPLETED';
    proposal.completedAt = new Date();
    proposal.executionOutput = {
      action: proposal.proposedAction,
      success: true,
      timestamp: new Date().toISOString(),
    };

    const saved = await this.proposalRepository.save(proposal);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'remediation_proposal',
      targetId: proposalId,
      metadata: { event: 'remediation_executed', action: proposal.proposedAction },
    });

    // Trigger post-remediation health re-evaluation
    if (proposal.clusterId) {
      await this.healthService.triggerHealthCheck(proposal.clusterId, 'POST_UPGRADE', actorId);
    }

    return saved;
  }

  async listPendingProposals(clusterId: string): Promise<RemediationProposalEntity[]> {
    return this.proposalRepository.find({
      where: { clusterId, status: In(['PENDING', 'APPROVED']) },
      order: { createdAt: 'DESC' },
    });
  }

  private isRateLimited(actorId: string): boolean {
    const now = Date.now();
    const cutoff = now - 3600000;
    const executions = (this.recentExecutions.get(actorId) ?? []).filter((t) => t > cutoff);
    return executions.length >= this.RATE_LIMIT_PER_HOUR;
  }

  private recordExecution(actorId: string): void {
    const executions = this.recentExecutions.get(actorId) ?? [];
    executions.push(Date.now());
    this.recentExecutions.set(actorId, executions.slice(-this.RATE_LIMIT_PER_HOUR));
  }
}
