/**
 * Velero Restore Rehearsal Automated Test Procedure (WO-107)
 *
 * Tests the full backup → request-restore → approve → execute workflow
 * using mocked Kubernetes/Velero CRD calls.
 *
 * Run with: npx jest --testPathPattern=velero-restore-rehearsal --runInBand
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

jest.setTimeout(60_000);

// Mock Velero CRD client — replaces the real Kubernetes API calls
const mockVeleroBackups: Record<string, { name: string; phase: string; completionTimestamp?: string }> = {};
const mockVeleroRestores: Record<string, { name: string; phase: string }> = {};

jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    loadFromCluster: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({
      createNamespacedCustomObject: jest.fn().mockImplementation(
        (_group: string, _version: string, _ns: string, plural: string, body: { metadata: { name: string } }) => {
          const name = body.metadata.name;
          if (plural === 'backups') {
            mockVeleroBackups[name] = { name, phase: 'Completed', completionTimestamp: new Date().toISOString() };
          } else if (plural === 'restores') {
            mockVeleroRestores[name] = { name, phase: 'Completed' };
          }
          return Promise.resolve({ body });
        },
      ),
      getNamespacedCustomObject: jest.fn().mockImplementation(
        (_group: string, _version: string, _ns: string, plural: string, name: string) => {
          if (plural === 'backups' && mockVeleroBackups[name]) {
            return Promise.resolve({ body: { status: { phase: 'Completed' }, metadata: { name } } });
          }
          if (plural === 'restores' && mockVeleroRestores[name]) {
            return Promise.resolve({ body: { status: { phase: 'Completed' }, metadata: { name } } });
          }
          return Promise.resolve({ body: { status: { phase: 'InProgress' }, metadata: { name } } });
        },
      ),
    }),
  })),
  CustomObjectsApi: jest.fn(),
}));

describe('Velero Restore Rehearsal', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let clusterId: string;
  let backupId: string;
  let restoreId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = moduleRef.get(DataSource);
    authToken = 'test-admin-token';
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeAll(async () => {
    // Create a test cluster to work against
    const res = await request(app.getHttpServer())
      .post('/api/clusters')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'velero-test-cluster',
        region: 'us-east-1',
        awsAccountId: '123456789012',
        currentVersion: '1.28',
      });
    clusterId = res.body?.id ?? 'test-cluster-id';
  });

  describe('Step 1: Trigger backup', () => {
    it('should trigger a Velero backup for the cluster', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/backup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clusterId, notes: 'Pre-upgrade rehearsal backup' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(['PENDING', 'IN_PROGRESS', 'COMPLETED']).toContain(res.body.status);
      backupId = res.body.id;
    });

    it('should return the backup in the list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/backup/${clusterId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const backup = (res.body as { id: string }[]).find((b) => b.id === backupId);
      expect(backup).toBeDefined();
    });
  });

  describe('Step 2: Request restore', () => {
    it('should request a restore from the backup', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/backup/restore')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          backupId,
          clusterId,
          notes: 'Rehearsal restore — automated test',
          requestedBy: 'test-admin',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING_APPROVAL');
      restoreId = res.body.id;
    });
  });

  describe('Step 3: Dual approval', () => {
    it('should accept first approval', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/backup/restore/${restoreId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ approverId: 'approver-1', notes: 'Approved by operator 1' })
        .expect(200);

      expect(['PENDING_APPROVAL', 'APPROVED']).toContain(res.body.status);
    });

    it('should accept second approval and transition to APPROVED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/backup/restore/${restoreId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ approverId: 'approver-2', notes: 'Approved by operator 2' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
    });
  });

  describe('Step 4: Execute restore', () => {
    it('should execute the approved restore', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/backup/restore/${restoreId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ actorId: 'test-admin' })
        .expect(200);

      expect(['IN_PROGRESS', 'COMPLETED']).toContain(res.body.status);
    });

    it('restore should eventually reach COMPLETED status', async () => {
      // Poll for up to 30 seconds
      let completed = false;
      for (let i = 0; i < 30; i++) {
        const res = await request(app.getHttpServer())
          .get(`/api/backup/restore/${restoreId}`)
          .set('Authorization', `Bearer ${authToken}`);
        if (res.body?.status === 'COMPLETED') {
          completed = true;
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      expect(completed).toBe(true);
    });
  });

  describe('Step 5: Post-restore validation', () => {
    it('should trigger a post-restore health check', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/health/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clusterId, trigger: 'MANUAL', notes: 'Post-restore validation' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.trigger).toBe('MANUAL');
    });
  });
});
