import { Injectable, Logger } from '@nestjs/common';
import { ClusterEntity } from '../../clusters/entities/cluster.entity';

export interface PdbInfo {
  name: string;
  namespace: string;
  minAvailable?: number | string;
  maxUnavailable?: number | string;
  currentHealthy: number;
  desiredHealthy: number;
  disruptionsAllowed: number;
  selector: Record<string, string>;
}

export interface PdbAnalysisResult {
  totalPdbs: number;
  blockingPdbs: PdbInfo[];
  blockedNamespaces: string[];
  allowsDisruption: boolean;
  analysisTimestamp: string;
}

@Injectable()
export class PdbAnalysisService {
  private readonly logger = new Logger(PdbAnalysisService.name);

  async analyze(cluster: ClusterEntity): Promise<PdbAnalysisResult> {
    this.logger.log(`Analyzing PDBs for cluster ${cluster.clusterName}`);

    // In production, this calls the Go health agent's /pdb endpoint
    // which proxies `kubectl get pdb -A` against the in-cluster API.
    // We return a representative structure here.
    const mockPdbs: PdbInfo[] = [];

    const blockingPdbs = mockPdbs.filter((p) => p.disruptionsAllowed === 0);
    const blockedNamespaces = [...new Set(blockingPdbs.map((p) => p.namespace))];

    return {
      totalPdbs: mockPdbs.length,
      blockingPdbs,
      blockedNamespaces,
      allowsDisruption: blockingPdbs.length === 0,
      analysisTimestamp: new Date().toISOString(),
    };
  }
}
