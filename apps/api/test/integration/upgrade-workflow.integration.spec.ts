/**
 * End-to-end integration tests for the EKS upgrade workflow.
 *
 * These tests exercise the full upgrade cycle against an in-memory
 * mock EKS API and a real NestJS application instance backed by an
 * in-process SQLite (or test PostgreSQL) database.
 *
 * Run with: npx jest --testPathPattern=integration --runInBand
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

jest.setTimeout(60_000);

describe('Upgrade Workflow (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let clusterId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('EKS_CLIENT')
      .useValue(mockEksClient())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);

    // Obtain an auth token (mock OIDC for test env)
    authToken = await obtainTestToken(app);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  it('should register a cluster', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/clusters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'test-cluster',
        region: 'us-east-1',
        awsAccountId: '123456789012',
        currentVersion: '1.28',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('test-cluster');
    clusterId = res.body.id;
  });

  it('should run a dry-run for the cluster', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/dryrun/${clusterId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ targetVersion: '1.29' })
      .expect(201);

    expect(res.body.passed).toBeDefined();
    expect(Array.isArray(res.body.checks)).toBe(true);
  });

  it('should create an upgrade job', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/upgrades')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ clusterId, targetVersion: '1.29' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PENDING');
  });

  it('should list upgrade jobs for the cluster', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/upgrades?clusterId=${clusterId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should trigger a health check after upgrade', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/health/trigger`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ clusterId, trigger: 'POST_UPGRADE' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.trigger).toBe('POST_UPGRADE');
  });

  it('should return fleet status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/fleet/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(typeof res.body.totalClusters).toBe('number');
    expect(typeof res.body.healthyClusters).toBe('number');
  });

  it('should return compliance report', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/compliance/report')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(typeof res.body.totalClusters).toBe('number');
    expect(typeof res.body.complianceScore).toBe('number');
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function obtainTestToken(app: INestApplication): Promise<string> {
  // In test environment the auth module accepts a special test header
  // that exchanges a test user ID for a JWT.
  const res = await request(app.getHttpServer())
    .post('/api/auth/test-token')
    .send({ userId: 'test-admin', role: 'admin' });

  return res.body?.token ?? 'test-token';
}

function mockEksClient() {
  return {
    send: jest.fn().mockImplementation((cmd: { constructor: { name: string } }) => {
      switch (cmd.constructor.name) {
        case 'DescribeClusterCommand':
          return Promise.resolve({
            cluster: {
              name: 'test-cluster',
              version: '1.29',
              status: 'ACTIVE',
            },
          });
        case 'UpdateClusterVersionCommand':
          return Promise.resolve({ update: { id: 'mock-update-id', status: 'InProgress' } });
        case 'DescribeUpdateCommand':
          return Promise.resolve({ update: { id: 'mock-update-id', status: 'Successful' } });
        case 'ListNodegroupsCommand':
          return Promise.resolve({ nodegroups: ['ng-1'] });
        default:
          return Promise.resolve({});
      }
    }),
  };
}
