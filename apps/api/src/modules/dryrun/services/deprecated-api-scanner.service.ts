import { Injectable, Logger } from '@nestjs/common';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

export interface DeprecatedApiResult {
  apiGroup: string;
  version: string;
  kind: string;
  replacementVersion?: string;
  removedInVersion?: string;
  removed: boolean;
  resourceCount: number;
  namespaces: string[];
}

// EKS deprecated/removed API reference per Kubernetes version
const DEPRECATED_API_MATRIX: Record<
  string,
  Array<{
    apiGroup: string;
    version: string;
    kind: string;
    replacement?: string;
    removedIn: string;
  }>
> = {
  '1.25': [
    { apiGroup: 'policy', version: 'v1beta1', kind: 'PodSecurityPolicy', removedIn: '1.25' },
    { apiGroup: 'autoscaling', version: 'v2beta1', kind: 'HorizontalPodAutoscaler', removedIn: '1.25', replacement: 'autoscaling/v2' },
    { apiGroup: 'batch', version: 'v1beta1', kind: 'CronJob', removedIn: '1.25', replacement: 'batch/v1' },
  ],
  '1.26': [
    { apiGroup: 'flowcontrol.apiserver.k8s.io', version: 'v1beta1', kind: 'FlowSchema', removedIn: '1.26', replacement: 'v1beta2' },
    { apiGroup: 'autoscaling', version: 'v2beta2', kind: 'HorizontalPodAutoscaler', removedIn: '1.26', replacement: 'autoscaling/v2' },
  ],
  '1.27': [
    { apiGroup: 'storage.k8s.io', version: 'v1beta1', kind: 'CSIStorageCapacity', removedIn: '1.27', replacement: 'storage.k8s.io/v1' },
  ],
  '1.29': [
    { apiGroup: 'flowcontrol.apiserver.k8s.io', version: 'v1beta2', kind: 'FlowSchema', removedIn: '1.29', replacement: 'v1' },
    { apiGroup: 'flowcontrol.apiserver.k8s.io', version: 'v1beta3', kind: 'FlowSchema', removedIn: '1.32', replacement: 'v1' },
  ],
};

@Injectable()
export class DeprecatedApiScannerService {
  private readonly logger = new Logger(DeprecatedApiScannerService.name);

  async scan(cluster: ClusterEntity, targetVersion: string): Promise<DeprecatedApiResult[]> {
    this.logger.log(
      `Scanning deprecated APIs for cluster ${cluster.clusterName}, target ${targetVersion}`,
    );

    // In production this would call the health agent which runs kubectl-convert
    // or queries the API server for deprecated API usage.
    // We return the known removed/deprecated APIs for the target version.

    const targetMinor = this.parseMinor(targetVersion);
    const results: DeprecatedApiResult[] = [];

    for (const [version, apis] of Object.entries(DEPRECATED_API_MATRIX)) {
      const removedMinor = this.parseMinor(version);
      if (removedMinor > targetMinor) continue;

      for (const api of apis) {
        results.push({
          apiGroup: api.apiGroup,
          version: api.version,
          kind: api.kind,
          replacementVersion: api.replacement,
          removedInVersion: api.removedIn,
          removed: removedMinor <= targetMinor,
          resourceCount: 0, // Would be populated from real kubectl query
          namespaces: [],
        });
      }
    }

    return results;
  }

  private parseMinor(version: string): number {
    const match = /^\d+\.(\d+)/.exec(version);
    return match ? parseInt(match[1], 10) : 0;
  }
}
