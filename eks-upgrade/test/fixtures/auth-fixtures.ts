import {
  User,
  Role,
  Permission,
  Session,
} from '../../apps/api/src/database/entities';

export function createRole(overrides?: Partial<Role>): Partial<Role> {
  return {
    id: 'role-uuid-001',
    name: 'upgrade_operator',
    description: 'Can initiate and manage upgrades in dev and staging environments',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createUser(overrides?: Partial<User>): Partial<User> {
  return {
    id: 'user-uuid-001',
    oidcSubject: 'google-oauth2|123456789012345678901',
    email: 'operator@example.com',
    displayName: 'Test Operator',
    role: 'upgrade_operator',
    status: 'active',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createPermission(
  overrides?: Partial<Permission>,
): Partial<Permission> {
  return {
    id: 'permission-uuid-001',
    roleId: 'role-uuid-001',
    resourceType: 'cluster',
    action: 'read',
    environmentScope: '*',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createSession(overrides?: Partial<Session>): Partial<Session> {
  const now = new Date();
  const idleTimeout = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
  const absoluteTimeout = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  return {
    id: 'session-uuid-001',
    userId: 'user-uuid-001',
    refreshTokenHash: 'sha256$abcdef123456',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    idleTimeoutAt: idleTimeout,
    absoluteTimeoutAt: absoluteTimeout,
    createdAt: now,
    revokedAt: null,
    ...overrides,
  };
}

export const ROLE_NAMES = [
  'upgrade_operator',
  'sre_oncall',
  'cluster_admin',
  'change_coordinator',
  'compliance_reviewer',
] as const;

export const ROLE_DESCRIPTIONS = {
  upgrade_operator: 'Can initiate and manage upgrades in dev and staging environments',
  sre_oncall: 'Can perform emergency operations including health checks and remediation in all environments',
  cluster_admin: 'Full administrative access to all cluster operations in all environments',
  change_coordinator: 'Can approve and coordinate changes across all environments',
  compliance_reviewer: 'Read-only access for audit and compliance purposes',
};

export const EXPECTED_PERMISSION_COUNTS = {
  upgrade_operator: 7,
  sre_oncall: 8,
  cluster_admin: 7,
  change_coordinator: 7,
  compliance_reviewer: 8,
};
