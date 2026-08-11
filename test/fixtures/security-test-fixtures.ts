import { ROLES } from '../../apps/api/src/auth/constants/roles';

export interface EndpointTestCase {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  roles: {
    [key: string]: number; // Role name -> expected HTTP status
  };
}

/**
 * Comprehensive test matrix for access control validation.
 * Maps each endpoint to expected status codes for each role.
 */
export const ENDPOINT_TEST_MATRIX: EndpointTestCase[] = [
  // Clusters
  {
    path: '/api/v1/clusters',
    method: 'GET',
    roles: {
      [ROLES.UPGRADE_OPERATOR]: 200,
      [ROLES.SRE_ONCALL]: 200,
      [ROLES.CLUSTER_ADMIN]: 200,
      [ROLES.CHANGE_COORDINATOR]: 200,
      [ROLES.COMPLIANCE_REVIEWER]: 200,
    },
  },
  {
    path: '/api/v1/clusters',
    method: 'POST',
    roles: {
      [ROLES.UPGRADE_OPERATOR]: 403,
      [ROLES.SRE_ONCALL]: 403,
      [ROLES.CLUSTER_ADMIN]: 201,
      [ROLES.CHANGE_COORDINATOR]: 403,
      [ROLES.COMPLIANCE_REVIEWER]: 403,
    },
  },
  
  // Audit (read-only for compliance reviewer)
  {
    path: '/api/v1/audit',
    method: 'GET',
    roles: {
      [ROLES.UPGRADE_OPERATOR]: 403,
      [ROLES.SRE_ONCALL]: 403,
      [ROLES.CLUSTER_ADMIN]: 403,
      [ROLES.CHANGE_COORDINATOR]: 403,
      [ROLES.COMPLIANCE_REVIEWER]: 200,
    },
  },
  {
    path: '/api/v1/audit/export',
    method: 'POST',
    roles: {
      [ROLES.UPGRADE_OPERATOR]: 403,
      [ROLES.SRE_ONCALL]: 403,
      [ROLES.CLUSTER_ADMIN]: 403,
      [ROLES.CHANGE_COORDINATOR]: 403,
      [ROLES.COMPLIANCE_REVIEWER]: 202,
    },
  },
];

/**
 * Endpoints that should be publicly accessible (no JWT required)
 */
export const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/health/ready' },
  { method: 'GET', path: '/api/v1/auth/authorize' },
  { method: 'POST', path: '/api/v1/auth/callback' },
  { method: 'POST', path: '/api/v1/auth/refresh' },
];

/**
 * Write operations that should always be blocked for compliance reviewer
 */
export const WRITE_OPERATIONS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const COMPLIANCE_REVIEWER_BLOCKED_PATHS = [
  '/api/v1/clusters',
  '/api/v1/upgrades',
  '/api/v1/backups',
  '/api/v1/campaigns',
];
