import { Cluster } from '../../stores/fleet.store';

export const mockClusters: Cluster[] = [
  {
    id: 'cluster-1',
    name: 'production-us-east-1',
    region: 'us-east-1',
    version: '1.28',
    status: 'healthy',
  },
  {
    id: 'cluster-2',
    name: 'staging-us-west-2',
    region: 'us-west-2',
    version: '1.27',
    status: 'upgrading',
  },
  {
    id: 'cluster-3',
    name: 'development-eu-west-1',
    region: 'eu-west-1',
    version: '1.28',
    status: 'healthy',
  },
];
