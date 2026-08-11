import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthService, AgentHealthData } from '../services/health.service';
import { HealthCheckEntity } from '../entities/health-check.entity';
import { ClusterService } from '../../clusters/services/cluster.service';

interface HealthCheckJobData {
  healthCheckId: string;
  clusterId: string;
  upgradeJobId?: string;
}

@Processor('health-check', { concurrency: 5 })
export class HealthCheckWorker extends WorkerHost {
  private readonly logger = new Logger(HealthCheckWorker.name);

  constructor(
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepository: Repository<HealthCheckEntity>,
    private readonly healthService: HealthService,
    private readonly clusterService: ClusterService,
  ) {
    super();
  }

  async process(job: Job<HealthCheckJobData>): Promise<void> {
    const { healthCheckId, clusterId } = job.data;
    this.logger.log(`Running health check ${healthCheckId} for cluster ${clusterId}`);

    const cluster = await this.clusterService.getClusterById(clusterId);

    // In production, call the in-cluster health agent at its service endpoint
    // e.g. http://<agent-service>.<namespace>.svc.cluster.local:8080/findings
    const agentEndpoint = cluster.agentEndpoint ?? `http://health-agent.${cluster.clusterName}:8080`;

    let agentData: AgentHealthData;
    try {
      const response = await fetch(`${agentEndpoint}/findings`, {
        signal: AbortSignal.timeout(30000),
      });
      agentData = await response.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Agent endpoint unreachable for cluster ${clusterId}: ${msg}`);

      // Return a degraded result rather than failing completely
      agentData = {
        findings: [
          {
            severity: 'warning',
            category: 'agent_connectivity',
            title: 'Health Agent Unreachable',
            description: `Could not connect to health agent at ${agentEndpoint}: ${msg}`,
            resource: 'health-agent',
            remediation: 'Verify the health agent is deployed and accessible',
          },
        ],
        totalCount: 1,
        criticalCount: 0,
        highCount: 0,
        snapshotTime: new Date().toISOString(),
      };
    }

    await this.healthService.recordHealthResult(healthCheckId, agentData);
    this.logger.log(
      `Health check ${healthCheckId} complete: ${agentData.criticalCount} critical, ${agentData.highCount} high`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<HealthCheckJobData>, error: Error): Promise<void> {
    this.logger.error(`Health check job ${job.id} failed: ${error.message}`);
    const healthCheck = await this.healthCheckRepository.findOne({
      where: { id: job.data.healthCheckId },
    });
    if (healthCheck) {
      healthCheck.status = 'FAILED';
      healthCheck.errorMessage = error.message;
      healthCheck.completedAt = new Date();
      await this.healthCheckRepository.save(healthCheck);
    }
  }
}
