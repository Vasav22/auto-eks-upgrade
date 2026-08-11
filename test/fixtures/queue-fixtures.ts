import {
  UpgradePollPayload,
  HealthCheckPayload,
  BackupPayload,
  DiscoveryPayload,
  PurgePayload,
} from '../../apps/api/src/redis/queues/payloads';

export function createUpgradePollPayload(
  overrides?: Partial<UpgradePollPayload>,
): UpgradePollPayload {
  return {
    jobId: 'job-upgrade-001',
    clusterId: 'cluster-eks-prod-us-east-1',
    awsUpdateId: 'update-f8b2c4e6-3d9a-4b2f-8e7c-1d5a9b3c6f2e',
    accountRoleArn: 'arn:aws:iam::123456789012:role/EKSUpgradeControlPlane',
    ...overrides,
  };
}

export function createHealthCheckPayload(
  overrides?: Partial<HealthCheckPayload>,
): HealthCheckPayload {
  return {
    jobId: 'job-health-001',
    clusterId: 'cluster-eks-prod-us-east-1',
    upgradeJobId: 'job-upgrade-001',
    ...overrides,
  };
}

export function createBackupPayload(
  overrides?: Partial<BackupPayload>,
): BackupPayload {
  return {
    clusterId: 'cluster-eks-prod-us-east-1',
    backupScope: 'full',
    storageLocation: 's3://eks-backups/prod/us-east-1/cluster-eks-prod-us-east-1',
    ...overrides,
  };
}

export function createDiscoveryPayload(
  overrides?: Partial<DiscoveryPayload>,
): DiscoveryPayload {
  return {
    accountId: '123456789012',
    regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
    ...overrides,
  };
}

export function createPurgePayload(
  overrides?: Partial<PurgePayload>,
): PurgePayload {
  return {
    dataCategory: 'logs',
    retentionDays: 90,
    ...overrides,
  };
}
