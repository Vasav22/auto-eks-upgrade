import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { TEST_ROLES } from '../helpers/auth-test-helpers';
import { ENDPOINT_TEST_MATRIX } from '../fixtures/security-test-fixtures';

describe('Access Control Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Endpoint Access Matrix', () => {
    ENDPOINT_TEST_MATRIX.forEach((testCase) => {
      Object.entries(testCase.roles).forEach(([role, expectedStatus]) => {
        it(`${testCase.method} ${testCase.path} with ${role} should return ${expectedStatus}`, async () => {
          const jwt = TEST_ROLES[role as keyof typeof TEST_ROLES];
          
          const response = await request(app.getHttpServer())
            [testCase.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](testCase.path)
            .set('Cookie', [`access_token=${jwt}`])
            .send({});

          expect(response.status).toBe(expectedStatus);
          
          if (expectedStatus === 403) {
            expect(response.body).toHaveProperty('error', 'ACCESS_DENIED');
          }
        });
      });
    });
  });

  describe('Environment-Scoped Access', () => {
    it('upgrade_operator cannot execute production cluster upgrades', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clusters/prod-123/upgrade')
        .set('Cookie', [`access_token=${TEST_ROLES.upgradeOperator}`])
        .send({ target_version: '1.30' });

      expect(response.status).toBe(403);
    });

    it('cluster_admin can execute production cluster upgrades', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/clusters/prod-123/upgrade')
        .set('Cookie', [`access_token=${TEST_ROLES.clusterAdmin}`])
        .send({ target_version: '1.30' });

      // May return 404 if cluster doesn't exist, but not 403
      expect([200, 201, 404]).toContain(response.status);
    });
  });
});
