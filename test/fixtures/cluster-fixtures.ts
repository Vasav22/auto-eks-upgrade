import {
  ClusterAccount,
  Cluster,
} from '../../apps/api/src/database/entities';

export function createClusterAccount(
  overrides?: Partial<ClusterAccount>,
): Partial<ClusterAccount> {
  return {
    id: 'account-uuid-001',
    awsAccountId: '123456789012',
    roleArn: 'arn:aws:iam::123456789012:role/EKSUpgradeControlPlaneRole',
    externalId: 'external-id-secret-12345',
    status: 'active',
    lastAssumedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createCluster(
  overrides?: Partial<Cluster>,
): Partial<Cluster> {
  return {
    id: 'cluster-uuid-001',
    name: 'eks-prod-us-east-1',
    accountId: 'account-uuid-001',
    region: 'us-east-1',
    currentVersion: '1.29',
    status: 'healthy',
    environmentTag: 'production',
    discoveryMetadata: {
      vpc_id: 'vpc-12345678',
      subnet_ids: ['subnet-abc123', 'subnet-def456'],
      security_group_ids: ['sg-xyz789'],
      endpoint: 'https://ABC123.gr7.us-east-1.eks.amazonaws.com',
      created_at_aws: '2023-06-15T10:30:00Z',
    },
    lastDiscoveredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Factory for generating 3 sample accounts across regions
export function createSampleAccounts(): Partial<ClusterAccount>[] {
  return [
    createClusterAccount({
      id: 'account-prod-001',
      awsAccountId: '111111111111',
      roleArn: 'arn:aws:iam::111111111111:role/EKSUpgradeRole',
      externalId: 'external-prod-secret',
    }),
    createClusterAccount({
      id: 'account-staging-001',
      awsAccountId: '222222222222',
      roleArn: 'arn:aws:iam::222222222222:role/EKSUpgradeRole',
      externalId: 'external-staging-secret',
    }),
    createClusterAccount({
      id: 'account-dev-001',
      awsAccountId: '333333333333',
      roleArn: 'arn:aws:iam::333333333333:role/EKSUpgradeRole',
      externalId: 'external-dev-secret',
    }),
  ];
}

// Factory for generating 10 sample clusters distributed across accounts
export function createSampleClusters(): Partial<Cluster>[] {
  const accounts = createSampleAccounts();

  return [
    // Production clusters (us-east-1, us-west-2)
    createCluster({
      id: 'cluster-prod-001',
      name: 'eks-prod-main',
      accountId: accounts[0].id,
      region: 'us-east-1',
      currentVersion: '1.29',
      status: 'healthy',
      environmentTag: 'production',
    }),
    createCluster({
      id: 'cluster-prod-002',
      name: 'eks-prod-west',
      accountId: accounts[0].id,
      region: 'us-west-2',
      currentVersion: '1.28',
      status: 'healthy',
      environmentTag: 'production',
    }),
    createCluster({
      id: 'cluster-prod-003',
      name: 'eks-prod-dr',
      accountId: accounts[0].id,
      region: 'us-west-2',
      currentVersion: '1.29',
      status: 'healthy',
      environmentTag: 'production',
    }),

    // Staging clusters (us-east-1, eu-west-1)
    createCluster({
      id: 'cluster-staging-001',
      name: 'eks-staging-main',
      accountId: accounts[1].id,
      region: 'us-east-1',
      currentVersion: '1.30',
      status: 'healthy',
      environmentTag: 'staging',
    }),
    createCluster({
      id: 'cluster-staging-002',
      name: 'eks-staging-eu',
      accountId: accounts[1].id,
      region: 'eu-west-1',
      currentVersion: '1.29',
      status: 'healthy',
      environmentTag: 'staging',
    }),

    // Development clusters (us-east-1)
    createCluster({
      id: 'cluster-dev-001',
      name: 'eks-dev-team-a',
      accountId: accounts[2].id,
      region: 'us-east-1',
      currentVersion: '1.30',
      status: 'healthy',
      environmentTag: 'development',
    }),
    createCluster({
      id: 'cluster-dev-002',
      name: 'eks-dev-team-b',
      accountId: accounts[2].id,
      region: 'us-east-1',
      currentVersion: '1.28',
      status: 'upgrading',
      environmentTag: 'development',
    }),
    createCluster({
      id: 'cluster-dev-003',
      name: 'eks-dev-sandbox',
      accountId: accounts[2].id,
      region: 'us-east-1',
      currentVersion: '1.29',
      status: 'healthy',
      environmentTag: 'sandbox',
    }),

    // Legacy/deprecated clusters
    createCluster({
      id: 'cluster-legacy-001',
      name: 'eks-legacy-1-27',
      accountId: accounts[0].id,
      region: 'us-east-1',
      currentVersion: '1.27',
      status: 'unhealthy',
      environmentTag: 'production',
    }),
    createCluster({
      id: 'cluster-decom-001',
      name: 'eks-old-test',
      accountId: accounts[2].id,
      region: 'us-west-2',
      currentVersion: '1.26',
      status: 'decommissioned',
      environmentTag: 'development',
    }),
  ];
}

export const EKS_VERSIONS = ['1.26', '1.27', '1.28', '1.29', '1.30'] as const;

export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1',
] as const;

export const ENVIRONMENT_TAGS = [
  'production',
  'staging',
  'development',
  'sandbox',
] as const;

export const CLUSTER_STATUSES = [
  'discovered',
  'healthy',
  'unhealthy',
  'upgrading',
  'upgrade_failed',
  'decommissioned',
] as const;
