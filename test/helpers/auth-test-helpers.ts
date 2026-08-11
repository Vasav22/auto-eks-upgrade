import * as jwt from 'jsonwebtoken';
import { RoleName, ROLES } from '../../apps/api/src/auth/constants/roles';

const TEST_SIGNING_KEY = 'test-secret-key-do-not-use-in-production';

export interface TestJwtOptions {
  role: RoleName;
  userId?: string;
  email?: string;
  expiresIn?: string | number;
}

export function generateTestJwt(options: TestJwtOptions): string {
  const {
    role,
    userId = crypto.randomUUID(),
    email = `test-${role}@example.com`,
    expiresIn = '1h',
  } = options;

  const payload = {
    sub: userId,
    role,
    email,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, TEST_SIGNING_KEY, {
    algorithm: 'HS256',
    expiresIn,
  });
}

export function generateTamperedJwt(role: RoleName): string {
  // Generate valid JWT then manually tamper with payload
  const validJwt = generateTestJwt({ role });
  const [header, payload, signature] = validJwt.split('.');
  
  // Decode, modify role, re-encode (without re-signing)
  const decodedPayload = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf-8'),
  );
  decodedPayload.role = ROLES.CLUSTER_ADMIN; // Escalate to admin
  
  const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString(
    'base64url',
  );
  
  return `${header}.${tamperedPayload}.${signature}`;
}

export function generateExpiredJwt(role: RoleName): string {
  return generateTestJwt({ role, expiresIn: '-1h' });
}

export const TEST_ROLES = {
  upgradeOperator: generateTestJwt({ role: ROLES.UPGRADE_OPERATOR }),
  sreOncall: generateTestJwt({ role: ROLES.SRE_ONCALL }),
  clusterAdmin: generateTestJwt({ role: ROLES.CLUSTER_ADMIN }),
  changeCoordinator: generateTestJwt({ role: ROLES.CHANGE_COORDINATOR }),
  complianceReviewer: generateTestJwt({ role: ROLES.COMPLIANCE_REVIEWER }),
};
