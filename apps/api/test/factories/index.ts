/**
 * Mock data fixtures and factory functions for unit and integration tests.
 */
import { v4 as uuidv4 } from 'uuid';

// ── Cluster factory ────────────────────────────────────────────────────────

export interface MockCluster {
  id: string;
  name: string;
  region: string;
  awsAccountId: string;
  currentVersion: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockCluster(overrides: Partial<MockCluster> = {}): MockCluster {
  return {
    id: uuidv4(),
    name: `cluster-${Math.random().toString(36).slice(2, 8)}`,
    region: 'us-east-1',
    awsAccountId: '123456789012',
    currentVersion: '1.28',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Upgrade job factory ────────────────────────────────────────────────────

export interface MockUpgradeJob {
  id: string;
  clusterId: string;
  targetVersion: string;
  currentVersion: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
  actorId: string;
}

export function createMockUpgradeJob(overrides: Partial<MockUpgradeJob> = {}): MockUpgradeJob {
  return {
    id: uuidv4(),
    clusterId: uuidv4(),
    targetVersion: '1.29',
    currentVersion: '1.28',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    actorId: uuidv4(),
    ...overrides,
  };
}

// ── Health check factory ───────────────────────────────────────────────────

export interface MockHealthCheck {
  id: string;
  clusterId: string;
  trigger: 'MANUAL' | 'POST_UPGRADE' | 'SCHEDULED';
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'DEGRADED';
  findings: MockFinding[];
  createdAt: Date;
}

export interface MockFinding {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  resourceName?: string;
  namespace?: string;
}

export function createMockHealthCheck(overrides: Partial<MockHealthCheck> = {}): MockHealthCheck {
  return {
    id: uuidv4(),
    clusterId: uuidv4(),
    trigger: 'MANUAL',
    status: 'PASSED',
    findings: [],
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockCrashLoopFinding(overrides: Partial<MockFinding> = {}): MockFinding {
  return {
    type: 'CRASHLOOP_BACKOFF',
    severity: 'HIGH',
    message: 'Pod is in CrashLoopBackOff state',
    resourceName: `pod-${Math.random().toString(36).slice(2, 8)}`,
    namespace: 'default',
    ...overrides,
  };
}

export function createMockPdbFinding(overrides: Partial<MockFinding> = {}): MockFinding {
  return {
    type: 'PDB_DISRUPTION_BLOCKER',
    severity: 'CRITICAL',
    message: 'PodDisruptionBudget would block upgrade',
    resourceName: `pdb-${Math.random().toString(36).slice(2, 8)}`,
    namespace: 'kube-system',
    ...overrides,
  };
}

// ── AWS EKS mock client ────────────────────────────────────────────────────

export function createMockEksClient(clusterVersion = '1.29') {
  return {
    send: jest.fn().mockImplementation((cmd: { constructor: { name: string } }) => {
      switch (cmd.constructor.name) {
        case 'DescribeClusterCommand':
          return Promise.resolve({
            cluster: { version: clusterVersion, status: 'ACTIVE', name: 'test-cluster' },
          });
        case 'UpdateClusterVersionCommand':
          return Promise.resolve({ update: { id: 'u-123', status: 'InProgress' } });
        case 'DescribeUpdateCommand':
          return Promise.resolve({ update: { id: 'u-123', status: 'Successful' } });
        case 'ListNodegroupsCommand':
          return Promise.resolve({ nodegroups: ['ng-general'] });
        case 'DescribeNodegroupCommand':
          return Promise.resolve({
            nodegroup: { nodegroupName: 'ng-general', status: 'ACTIVE', releaseVersion: '1.29.1' },
          });
        default:
          return Promise.resolve({});
      }
    }),
  };
}

// ── STS mock client ────────────────────────────────────────────────────────

export function createMockStsClient(accountId = '123456789012') {
  return {
    send: jest.fn().mockImplementation((cmd: { constructor: { name: string } }) => {
      switch (cmd.constructor.name) {
        case 'AssumeRoleCommand':
          return Promise.resolve({
            Credentials: {
              AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
              SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
              SessionToken: 'mock-session-token',
              Expiration: new Date(Date.now() + 3600 * 1000),
            },
          });
        case 'GetCallerIdentityCommand':
          return Promise.resolve({
            Account: accountId,
            Arn: `arn:aws:sts::${accountId}:assumed-role/eks-upgrade-role/session`,
            UserId: 'AROA123456789:session',
          });
        default:
          return Promise.resolve({});
      }
    }),
  };
}

// ── Notification channel factory ───────────────────────────────────────────

export interface MockNotificationChannel {
  id: string;
  name: string;
  type: 'SLACK' | 'WEBHOOK';
  webhookUrl: string;
  isActive: boolean;
}

export function createMockNotificationChannel(
  overrides: Partial<MockNotificationChannel> = {},
): MockNotificationChannel {
  return {
    id: uuidv4(),
    name: '#eks-alerts',
    type: 'SLACK',
    webhookUrl: 'https://hooks.slack.com/services/T000/B000/mock',
    isActive: true,
    ...overrides,
  };
}
