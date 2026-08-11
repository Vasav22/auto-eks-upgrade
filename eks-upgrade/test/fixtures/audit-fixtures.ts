import { AuditRecord } from '../../apps/api/src/database/entities/audit-record.entity';

export function createAuditRecord(
  overrides?: Partial<AuditRecord>,
): Partial<AuditRecord> {
  return {
    id: 'audit-uuid-001',
    actorId: 'user-uuid-001',
    actorRole: 'upgrade_operator',
    action: 'cluster.upgrade.initiated',
    resourceType: 'cluster',
    resourceId: 'cluster-eks-prod-us-east-1',
    changeDetail: {
      from_version: '1.28',
      to_version: '1.29',
      environment: 'production',
    },
    approvalChain: {
      change_coordinator: {
        approved_by: 'user-coordinator-001',
        approved_at: new Date().toISOString(),
      },
    },
    requestId: 'req-upgrade-20260811-001',
    occurredAt: new Date(),
    ...overrides,
  };
}

export function createAuditRecordBatch(
  count: number,
  baseDate: Date,
  overrides?: Partial<AuditRecord>,
): Partial<AuditRecord>[] {
  const records: Partial<AuditRecord>[] = [];

  for (let i = 0; i < count; i++) {
    const occurredAt = new Date(baseDate);
    occurredAt.setMinutes(occurredAt.getMinutes() + i * 5);

    records.push(
      createAuditRecord({
        id: `audit-uuid-${String(i).padStart(3, '0')}`,
        action: `test.action.${i}`,
        occurredAt,
        ...overrides,
      }),
    );
  }

  return records;
}

export const AUDIT_ACTION_PATTERNS = {
  authentication: [
    'auth.login.success',
    'auth.login.failed',
    'auth.logout',
    'auth.token.refreshed',
    'auth.session.expired',
  ],
  cluster: [
    'cluster.upgrade.initiated',
    'cluster.upgrade.completed',
    'cluster.upgrade.failed',
    'cluster.upgrade.rollback',
    'cluster.discovered',
  ],
  approval: [
    'approval.requested',
    'approval.granted',
    'approval.denied',
    'approval.revoked',
  ],
  administrative: [
    'user.created',
    'user.role.changed',
    'user.deactivated',
    'permission.granted',
    'permission.revoked',
  ],
  compliance: [
    'audit.report.generated',
    'backup.created',
    'backup.restored',
    'data.purged',
  ],
} as const;
