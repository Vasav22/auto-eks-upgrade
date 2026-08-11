import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClusterService } from '../../clusters/services/cluster.service';
import { ValidationService } from '../../clusters/services/validation.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { NodeGroupEntity } from '../../node-groups/entities/node-group.entity';
import { DeprecatedApiScannerService, DeprecatedApiResult } from './deprecated-api-scanner.service';
import { PdbAnalysisService, PdbAnalysisResult } from './pdb-analysis.service';

export type ReadinessCheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';

export interface ReadinessCheck {
  name: string;
  description: string;
  status: ReadinessCheckStatus;
  details?: string;
  remediation?: string;
  blocking: boolean;
}

export interface DryRunReport {
  id: string;
  clusterId: string;
  targetVersion: string;
  generatedAt: string;
  overallStatus: 'READY' | 'NOT_READY' | 'WARNINGS';
  checks: ReadinessCheck[];
  deprecatedApis: DeprecatedApiResult[];
  pdbAnalysis: PdbAnalysisResult;
  blockers: string[];
  warnings: string[];
}

@Injectable()
export class DryRunService {
  private readonly logger = new Logger(DryRunService.name);

  constructor(
    @InjectRepository(NodeGroupEntity)
    private readonly nodeGroupRepository: Repository<NodeGroupEntity>,
    private readonly clusterService: ClusterService,
    private readonly validationService: ValidationService,
    private readonly auditService: AuditService,
    private readonly deprecatedApiScanner: DeprecatedApiScannerService,
    private readonly pdbAnalysis: PdbAnalysisService,
  ) {}

  async runDryRun(
    clusterId: string,
    targetVersion: string,
    actorId: string,
  ): Promise<DryRunReport> {
    const cluster = await this.clusterService.getClusterById(clusterId);
    if (!cluster) throw new NotFoundException(`Cluster ${clusterId} not found`);

    this.logger.log(`Running dry-run for cluster ${cluster.clusterName} → ${targetVersion}`);

    const checks: ReadinessCheck[] = [];

    // 1. Version skew validation
    const nodeGroups = await this.nodeGroupRepository.find({
      where: { cluster: { id: clusterId } },
    });
    const nodeVersions = nodeGroups.map((ng) => ng.currentVersion);
    const skewResult = this.validationService.validateVersionSkew(cluster.currentVersion, nodeVersions);
    checks.push({
      name: 'version_skew',
      description: 'Node group versions are within 2 minor versions of control plane',
      status: skewResult.valid ? 'PASS' : 'FAIL',
      details: skewResult.valid
        ? `All ${nodeGroups.length} node groups are within supported skew`
        : skewResult.errors.join('; '),
      remediation: skewResult.valid ? undefined : 'Upgrade node groups before upgrading control plane',
      blocking: !skewResult.valid,
    });

    // 2. Version eligibility check
    const upgradeValid = this.validationService.validateControlPlaneUpgrade(
      cluster.currentVersion,
      targetVersion,
      nodeVersions,
    );
    checks.push({
      name: 'upgrade_path',
      description: 'Target version is a valid upgrade path (max 2 minor versions)',
      status: upgradeValid.valid ? 'PASS' : 'FAIL',
      details: upgradeValid.valid
        ? `Upgrade from ${cluster.currentVersion} to ${targetVersion} is valid`
        : upgradeValid.errors?.join('; ') ?? 'Invalid upgrade path',
      blocking: !upgradeValid.valid,
    });

    // 3. Deprecated API scan
    const deprecatedApis = await this.deprecatedApiScanner.scan(cluster, targetVersion);
    const hasDeprecatedApis = deprecatedApis.some((a) => a.removed);
    checks.push({
      name: 'deprecated_apis',
      description: 'No removed Kubernetes APIs in use',
      status: hasDeprecatedApis ? 'FAIL' : deprecatedApis.length > 0 ? 'WARNING' : 'PASS',
      details: hasDeprecatedApis
        ? `${deprecatedApis.filter((a) => a.removed).length} removed APIs detected`
        : deprecatedApis.length > 0
          ? `${deprecatedApis.length} deprecated (not yet removed) APIs detected`
          : 'No deprecated APIs detected',
      remediation: hasDeprecatedApis
        ? 'Update manifests to use the replacement APIs before upgrading'
        : undefined,
      blocking: hasDeprecatedApis,
    });

    // 4. PDB disruption analysis
    const pdbResult = await this.pdbAnalysis.analyze(cluster);
    checks.push({
      name: 'pdb_disruption',
      description: 'PodDisruptionBudgets allow node draining',
      status: pdbResult.blockedNamespaces.length > 0 ? 'WARNING' : 'PASS',
      details:
        pdbResult.blockedNamespaces.length > 0
          ? `PDBs in ${pdbResult.blockedNamespaces.join(', ')} may block node drain`
          : 'All PDBs allow disruption',
      blocking: false,
    });

    // 5. Node count check
    const totalNodes = nodeGroups.reduce((sum, ng) => sum + ng.desiredSize, 0);
    checks.push({
      name: 'node_count',
      description: 'Cluster has nodes available for rolling upgrade',
      status: totalNodes === 0 ? 'FAIL' : totalNodes < 3 ? 'WARNING' : 'PASS',
      details: `${totalNodes} nodes across ${nodeGroups.length} node groups`,
      blocking: totalNodes === 0,
    });

    // 6. Node groups ready check
    const updatingGroups = nodeGroups.filter((ng) => ng.status !== 'ACTIVE');
    checks.push({
      name: 'node_groups_ready',
      description: 'All node groups are in ACTIVE state',
      status: updatingGroups.length > 0 ? 'FAIL' : 'PASS',
      details:
        updatingGroups.length > 0
          ? `Node groups not ready: ${updatingGroups.map((ng) => ng.name).join(', ')}`
          : 'All node groups are ACTIVE',
      blocking: updatingGroups.length > 0,
    });

    const blockers = checks.filter((c) => c.blocking && c.status === 'FAIL').map((c) => c.name);
    const warnings = checks.filter((c) => c.status === 'WARNING').map((c) => c.name);
    const overallStatus =
      blockers.length > 0 ? 'NOT_READY' : warnings.length > 0 ? 'WARNINGS' : 'READY';

    const report: DryRunReport = {
      id: crypto.randomUUID(),
      clusterId,
      targetVersion,
      generatedAt: new Date().toISOString(),
      overallStatus,
      checks,
      deprecatedApis,
      pdbAnalysis: pdbResult,
      blockers,
      warnings,
    };

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'cluster',
      targetId: clusterId,
      metadata: {
        event: 'dry_run_completed',
        targetVersion,
        overallStatus,
        blockerCount: blockers.length,
        warningCount: warnings.length,
      },
    });

    this.logger.log(
      `Dry-run complete for ${cluster.clusterName}: ${overallStatus}, blockers=${blockers.length}`,
    );

    return report;
  }
}
