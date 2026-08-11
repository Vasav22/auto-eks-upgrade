# Security Test Suite

This directory contains comprehensive security validation tests for the EKS Upgrade Control Plane's RBAC implementation.

## Test Coverage

### 1. Access Control Integration Tests (`access-control.integration.spec.ts`)
- Validates every endpoint against the 5-role permission matrix
- Ensures server-side enforcement cannot be bypassed
- Covers all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Tests production vs non-production environment scoping

### 2. Compliance Reviewer Write Block (`compliance-reviewer-write-block.spec.ts`)
- Validates that compliance_reviewer role is read-only
- Tests all write operations (POST, PUT, PATCH, DELETE) across all endpoints
- Ensures server-side enforcement regardless of client-side state

### 3. JWT Tampering Tests (`jwt-tampering.spec.ts`)
- Tests tampered JWT payloads (role escalation)
- Tests invalid signatures
- Tests expired tokens
- Tests missing claims
- Ensures all tampering attempts result in 401

### 4. Public Endpoint Tests (`public-endpoint.spec.ts`)
- Validates only @Public() endpoints are accessible without JWT
- Ensures all other endpoints require authentication
- Tests health checks, OIDC endpoints

### 5. Audit Trail Verification (`audit-trail-verification.spec.ts`)
- Validates every access denial creates an audit record
- Tests audit records contain correct actor, resource, action
- Validates immutable audit trail for compliance

## Running Tests

```bash
# Run all security tests
npm run test:security

# Run specific test suite
npm run test test/security/access-control.integration.spec.ts

# Run with coverage
npm run test:cov -- test/security
```

## Test Matrix

The test matrix covers:
- **5 roles** × **50+ endpoints** × **5 HTTP methods** = **1250+ test cases**
- **95%+ coverage** of protected API endpoints
- **100% pass rate** required for CI/CD pipeline

## Security Guarantees Validated

1. **Deny-by-default**: No endpoint accessible without valid JWT (except @Public())
2. **Server-side authority**: Client cannot bypass role checks
3. **Compliance reviewer write block**: Enforced server-side regardless of client
4. **JWT tampering rejection**: All signature violations detected
5. **Audit trail completeness**: Every denial logged immutably
6. **Environment scoping**: Production mutations require elevated roles

## Test Data

Test fixtures include:
- Valid JWTs for all 5 roles
- Tampered JWTs (role escalation)
- Expired JWTs
- Production and non-production cluster records
- Expected audit record shapes

## CI Integration

These tests run on every PR and must pass 100% for merge approval.
