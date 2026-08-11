import { HealthSeverity } from '@app/shared';

export interface HealthFinding {
  id: string;
  clusterId: string;
  resourceType: string;
  resourceName: string;
  namespace: string;
  severity: HealthSeverity;
  message: string;
  timestamp: string;
}

export const mockHealthFindings: HealthFinding[] = [
  {
    id: 'finding-1',
    clusterId: 'cluster-1',
    resourceType: 'Pod',
    resourceName: 'api-deployment-abc123',
    namespace: 'default',
    severity: HealthSeverity.CRITICAL,
    message: 'Pod in CrashLoopBackOff state',
    timestamp: '2026-08-11T00:00:00Z',
  },
  {
    id: 'finding-2',
    clusterId: 'cluster-2',
    resourceType: 'Node',
    resourceName: 'ip-10-0-1-123',
    namespace: '',
    severity: HealthSeverity.WARNING,
    message: 'Node disk pressure detected',
    timestamp: '2026-08-11T00:05:00Z',
  },
];
