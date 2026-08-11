import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HealthCheckEntity } from '../entities/health-check.entity';
import { ClusterService } from '../../clusters/services/cluster.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { UpgradeEventsGateway } from '../../../gateways/upgrade-events.gateway';

export interface HealthFinding {
  severity: 'critical' | 'high' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  resource: string;
  namespace?: string;
  remediation?: string;
}

export interface AgentHealthData {
  findings: HealthFinding[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  snapshotTime: string;
  nodeSummary?: { total: number; ready: number };
  podSummary?: { total: number; running: number };
  pdbSummary?: { total: number; blocking: number };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepository: Repository<HealthCheckEntity>,
    @InjectQueue('health-check')
    private readonly healthQueue: Queue,
    private readonly clusterService: ClusterService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: UpgradeEventsGateway,
  ) {}

  async triggerHealthCheck(
    clusterId: string,
    trigger: 'MANUAL' | 'POST_UPGRADE' | 'SCHEDULED',
    actorId: string,
    upgradeJobId?: string,
  ): Promise<HealthCheckEntity> {
    const cluster = await this.clusterService.getClusterById(clusterId);
    if (!cluster) throw new NotFoundException(`Cluster ${clusterId} not found`);

    const healthCheck = this.healthCheckRepository.create({
      cluster: { id: clusterId } as any,
      upgradeJobId,
      trigger,
      status: 'RUNNING',
    });

    const saved = await this.healthCheckRepository.save(healthCheck);

    await this.healthQueue.add(
      'run-health-check',
      { healthCheckId: saved.id, clusterId, upgradeJobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
      },
    );

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'cluster',
      targetId: clusterId,
      metadata: { event: 'health_check_triggered', trigger, healthCheckId: saved.id },
    });

    return saved;
  }

  async recordHealthResult(
    healthCheckId: string,
    agentData: AgentHealthData,
  ): Promise<HealthCheckEntity> {
    const healthCheck = await this.healthCheckRepository.findOne({
      where: { id: healthCheckId },
    });

    if (!healthCheck) throw new NotFoundException(`Health check ${healthCheckId} not found`);

    const overallHealth =
      agentData.criticalCount > 0
        ? 'CRITICAL'
        : agentData.highCount > 0
          ? 'WARNING'
          : 'HEALTHY';

    healthCheck.status = 'COMPLETED';
    healthCheck.overallHealth = overallHealth;
    healthCheck.totalFindings = agentData.totalCount;
    healthCheck.criticalCount = agentData.criticalCount;
    healthCheck.highCount = agentData.highCount;
    healthCheck.warningCount = agentData.findings.filter((f) => f.severity === 'warning').length;
    healthCheck.findings = agentData.findings;
    healthCheck.nodeSummary = agentData.nodeSummary;
    healthCheck.podSummary = agentData.podSummary;
    healthCheck.pdbSummary = agentData.pdbSummary;
    healthCheck.completedAt = new Date();

    const saved = await this.healthCheckRepository.save(healthCheck);

    await this.eventsGateway.emitUpgradeEvent(
      healthCheck.cluster?.id ?? healthCheckId,
      'health_check_completed',
      {
        healthCheckId,
        overallHealth,
        totalFindings: agentData.totalCount,
        criticalCount: agentData.criticalCount,
      },
    );

    return saved;
  }

  async getLatestHealthCheck(clusterId: string): Promise<HealthCheckEntity | null> {
    return this.healthCheckRepository.findOne({
      where: { cluster: { id: clusterId } },
      order: { createdAt: 'DESC' },
    });
  }

  async listForCluster(clusterId: string): Promise<HealthCheckEntity[]> {
    return this.healthCheckRepository.find({
      where: { cluster: { id: clusterId } },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
