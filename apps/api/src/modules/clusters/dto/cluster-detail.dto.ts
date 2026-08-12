import { ClusterEntity } from '../../../database/entities/cluster.entity';
import { ClusterVersionInfo } from '../services/version.service';

export class ClusterDetailDto {
  id: string;
  clusterName: string;
  clusterArn: string;
  region: string;
  eksVersion: string;
  status: string;
  endpoint: string | null;
  lastSyncedAt: Date;
  createdAt: Date;
  account: {
    id: string;
    accountName: string;
    defaultRegion: string;
  };
  versionInfo: ClusterVersionInfo | null;

  static fromEntity(
    cluster: ClusterEntity,
    versionInfo: ClusterVersionInfo | null,
  ): ClusterDetailDto {
    return {
      id: cluster.id,
      clusterName: cluster.clusterName,
      clusterArn: cluster.clusterArn,
      region: cluster.region,
      eksVersion: cluster.eksVersion,
      status: cluster.status,
      endpoint: cluster.endpoint,
      lastSyncedAt: cluster.lastSyncedAt,
      createdAt: cluster.createdAt,
      account: {
        id: cluster.account.id,
        accountName: cluster.account.accountName,
        defaultRegion: cluster.account.defaultRegion,
      },
      versionInfo,
    };
  }
}
