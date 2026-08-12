import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';
import { HealthCheckEntity } from '../../health/entities/health-check.entity';
import { UpgradeEventsGateway } from '../../../gateways/upgrade-events.gateway';

export interface ClusterSummary {
  id: string;
  clusterName: string;
  region: string;
  eksVersion: string;
  status: string;
  accountId: string;
  accountName: string;
  lastSyncedAt: Date | null;
  latestHealthStatus?: string;
  latestHealthFindings?: number;
  latestUpgradeStatus?: string;
}

export interface FleetStatus {
  totalClusters: number;
  healthyClusters: number;
  warningClusters: number;
  criticalClusters: number;
  unknownClusters: number;
  upgradingClusters: number;
  versionDistribution: Record<string, number>;
  regionDistribution: Record<string, number>;
  generatedAt: string;
}

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);
  private cachedStatus: FleetStatus | null = null;
  private cacheExpiresAt: Date | null = null;
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(
    @InjectRepository(ClusterEntity)
    private readonly clusterRepository: Repository<ClusterEntity>,
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepository: Repository<HealthCheckEntity>,
    private readonly eventsGateway: UpgradeEventsGateway,
  ) {}

  async getFleetStatus(): Promise<FleetStatus> {
    const now = new Date();
    if (this.cachedStatus && this.cacheExpiresAt && now < this.cacheExpiresAt) {
      return this.cachedStatus;
    }

    const clusters = await this.clusterRepository.find({
      relations: ['account'],
      order: { clusterName: 'ASC' },
    });

    const latestHealthByCluster = await this.getLatestHealthByCluster(
      clusters.map((c) => c.id),
    );

    let healthy = 0, warning = 0, critical = 0, unknown = 0;
    const versionDist: Record<string, number> = {};
    const regionDist: Record<string, number> = {};

    for (const cluster of clusters) {
      const health = latestHealthByCluster[cluster.id];
      if (!health) { unknown++; }
      else if (health.overallHealth === 'HEALTHY') { healthy++; }
      else if (health.overallHealth === 'WARNING') { warning++; }
      else if (health.overallHealth === 'CRITICAL') { critical++; }
      else { unknown++; }

      versionDist[cluster.eksVersion] = (versionDist[cluster.eksVersion] ?? 0) + 1;
      regionDist[cluster.region] = (regionDist[cluster.region] ?? 0) + 1;
    }

    const status: FleetStatus = {
      totalClusters: clusters.length,
      healthyClusters: healthy,
      warningClusters: warning,
      criticalClusters: critical,
      unknownClusters: unknown,
      upgradingClusters: 0,
      versionDistribution: versionDist,
      regionDistribution: regionDist,
      generatedAt: now.toISOString(),
    };

    this.cachedStatus = status;
    this.cacheExpiresAt = new Date(now.getTime() + this.CACHE_TTL_SECONDS * 1000);

    return status;
  }

  async getClusters(page = 1, limit = 50): Promise<{ clusters: ClusterSummary[]; total: number }> {
    const [clusters, total] = await this.clusterRepository.findAndCount({
      relations: ['account'],
      order: { clusterName: 'ASC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const latestHealth = await this.getLatestHealthByCluster(clusters.map((c) => c.id));

    const summaries: ClusterSummary[] = clusters.map((c) => {
      const health = latestHealth[c.id];
      return {
        id: c.id,
        clusterName: c.clusterName,
        region: c.region,
        eksVersion: c.eksVersion,
        status: c.status ?? 'ACTIVE',
        accountId: c.account?.awsAccountId ?? '',
        accountName: c.account?.accountName ?? '',
        lastSyncedAt: c.lastSyncedAt,
        latestHealthStatus: health?.overallHealth,
        latestHealthFindings: health?.totalFindings,
      };
    });

    return { clusters: summaries, total };
  }

  async broadcastFleetUpdate(): Promise<void> {
    const status = await this.getFleetStatus();
    await this.eventsGateway.emitUpgradeEvent('fleet', 'fleet_status_update', status);
  }

  private async getLatestHealthByCluster(
    clusterIds: string[],
  ): Promise<Record<string, HealthCheckEntity>> {
    if (clusterIds.length === 0) return {};

    const checks = await this.healthCheckRepository
      .createQueryBuilder('hc')
      .where('hc.cluster_id IN (:...ids)', { ids: clusterIds })
      .orderBy('hc.created_at', 'DESC')
      .getMany();

    const result: Record<string, HealthCheckEntity> = {};
    for (const check of checks) {
      const clusterId = (check as any).cluster_id ?? check.cluster?.id;
      if (clusterId && !result[clusterId]) {
        result[clusterId] = check;
      }
    }
    return result;
  }
}
