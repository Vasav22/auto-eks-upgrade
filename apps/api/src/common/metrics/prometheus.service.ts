import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterEntity } from '../../modules/clusters/entities/cluster.entity';
import { HealthCheckEntity } from '../../modules/health/entities/health-check.entity';
import { UpgradeJobEntity } from '../../database/entities/upgrade-job.entity';

@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();

  constructor(
    @InjectRepository(ClusterEntity)
    private readonly clusterRepository: Repository<ClusterEntity>,
    @InjectRepository(HealthCheckEntity)
    private readonly healthCheckRepository: Repository<HealthCheckEntity>,
    @InjectRepository(UpgradeJobEntity)
    private readonly upgradeJobRepository: Repository<UpgradeJobEntity>,
  ) {}

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) ?? [];
    values.push(value);
    if (values.length > 1000) values.shift();
    this.histograms.set(key, values);
  }

  async scrapeMetrics(): Promise<string> {
    const lines: string[] = [];

    // DB-backed metrics
    try {
      const clusterCount = await this.clusterRepository.count();
      this.setGauge('eks_upgrade_clusters_total', clusterCount);

      const activeUpgrades = await this.upgradeJobRepository.count({
        where: { status: 'IN_PROGRESS' as any },
      });
      this.setGauge('eks_upgrade_jobs_active', activeUpgrades);

      const criticalHealth = await this.healthCheckRepository.count({
        where: { overallHealth: 'CRITICAL' },
      });
      this.setGauge('eks_upgrade_health_critical_clusters', criticalHealth);
    } catch (err) {
      this.logger.warn(`Metrics scrape error: ${err instanceof Error ? err.message : err}`);
    }

    // Emit counters
    lines.push('# HELP eks_upgrade_api_requests_total Total API request count');
    lines.push('# TYPE eks_upgrade_api_requests_total counter');
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    // Emit gauges
    lines.push('# HELP eks_upgrade_clusters_total Total registered clusters');
    lines.push('# TYPE eks_upgrade_clusters_total gauge');
    lines.push('# HELP eks_upgrade_jobs_active Currently running upgrade jobs');
    lines.push('# TYPE eks_upgrade_jobs_active gauge');
    lines.push('# HELP eks_upgrade_health_critical_clusters Clusters with CRITICAL health');
    lines.push('# TYPE eks_upgrade_health_critical_clusters gauge');
    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    // Simple histogram summaries
    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      lines.push(`${key}_sum ${sum}`);
      lines.push(`${key}_count ${values.length}`);
      lines.push(`${key}_avg ${avg.toFixed(3)}`);
      lines.push(`${key}_max ${max}`);
    }

    return lines.join('\n') + '\n';
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}
