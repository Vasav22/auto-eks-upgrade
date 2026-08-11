import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';
import { AuditRecord } from '../../audit/entities/audit-record.entity';
import { HealthCheckEntity } from '../../health/entities/health-check.entity';

export interface ComplianceReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  clusterCount: number;
  upgradeCompliance: {
    upToDateClusters: number;
    outdatedClusters: number;
    supportedVersionPercentage: number;
  };
  securityCompliance: {
    clustersWithRecentHealthCheck: number;
    clustersWithCriticalFindings: number;
    avgFindingsPerCluster: number;
  };
  auditSummary: {
    totalEvents: number;
    authEvents: number;
    mutationEvents: number;
    accessDenialEvents: number;
  };
  clusters: Array<{
    id: string;
    clusterName: string;
    version: string;
    region: string;
    healthStatus?: string;
    lastHealthCheck?: string;
    complianceScore: number;
  }>;
}

const SUPPORTED_VERSIONS = ['1.27', '1.28', '1.29', '1.30', '1.31', '1.32'];

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectRepository(ClusterEntity)
    private readonly clusterRepository: Repository<ClusterEntity>,
    @InjectRepository(AuditRecord)
    private readonly auditRepository: Repository<AuditRecord>,
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepository: Repository<HealthCheckEntity>,
  ) {}

  async generateReport(days = 30): Promise<ComplianceReport> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 86400000);

    const clusters = await this.clusterRepository.find({ relations: ['account'] });

    const latestHealthByCluster = await this.getLatestHealth(clusters.map((c) => c.id));

    const upToDate = clusters.filter((c) =>
      SUPPORTED_VERSIONS.includes(c.currentVersion),
    ).length;

    const clustersWithRecent = clusters.filter((c) => {
      const hc = latestHealthByCluster[c.id];
      return hc && hc.createdAt > periodStart;
    }).length;

    const totalFindings = Object.values(latestHealthByCluster).reduce(
      (sum, hc) => sum + (hc.totalFindings ?? 0), 0,
    );

    const criticalClusters = Object.values(latestHealthByCluster).filter(
      (hc) => hc.overallHealth === 'CRITICAL',
    ).length;

    const auditEvents = await this.auditRepository.count();

    const clusterSummaries = clusters.map((c) => {
      const hc = latestHealthByCluster[c.id];
      let score = 100;
      if (!SUPPORTED_VERSIONS.includes(c.currentVersion)) score -= 30;
      if (!hc) score -= 20;
      else if (hc.overallHealth === 'CRITICAL') score -= 40;
      else if (hc.overallHealth === 'WARNING') score -= 15;

      return {
        id: c.id,
        clusterName: c.clusterName,
        version: c.currentVersion,
        region: c.region,
        healthStatus: hc?.overallHealth,
        lastHealthCheck: hc?.createdAt?.toISOString(),
        complianceScore: Math.max(0, score),
      };
    });

    return {
      generatedAt: now.toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      clusterCount: clusters.length,
      upgradeCompliance: {
        upToDateClusters: upToDate,
        outdatedClusters: clusters.length - upToDate,
        supportedVersionPercentage: clusters.length > 0 ? Math.round((upToDate / clusters.length) * 100) : 100,
      },
      securityCompliance: {
        clustersWithRecentHealthCheck: clustersWithRecent,
        clustersWithCriticalFindings: criticalClusters,
        avgFindingsPerCluster: clusters.length > 0 ? Math.round(totalFindings / clusters.length * 10) / 10 : 0,
      },
      auditSummary: {
        totalEvents: auditEvents,
        authEvents: 0,
        mutationEvents: auditEvents,
        accessDenialEvents: 0,
      },
      clusters: clusterSummaries,
    };
  }

  private async getLatestHealth(clusterIds: string[]): Promise<Record<string, HealthCheckEntity>> {
    if (clusterIds.length === 0) return {};
    const checks = await this.healthCheckRepository
      .createQueryBuilder('hc')
      .where('hc.cluster_id IN (:...ids)', { ids: clusterIds })
      .orderBy('hc.created_at', 'DESC')
      .getMany();

    const result: Record<string, HealthCheckEntity> = {};
    for (const check of checks) {
      const cid = (check as any).cluster_id ?? check.cluster?.id;
      if (cid && !result[cid]) result[cid] = check;
    }
    return result;
  }
}
