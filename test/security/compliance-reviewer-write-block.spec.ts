import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { TEST_ROLES } from '../helpers/auth-test-helpers';
import { COMPLIANCE_REVIEWER_BLOCKED_PATHS, WRITE_OPERATIONS } from '../fixtures/security-test-fixtures';

describe('Compliance Reviewer Write Block', () => {
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

  describe('Server-Side Write Block Enforcement', () => {
    COMPLIANCE_REVIEWER_BLOCKED_PATHS.forEach((path) => {
      WRITE_OPERATIONS.forEach((method) => {
        it(`${method} ${path} with compliance_reviewer should return 403`, async () => {
          const response = await request(app.getHttpServer())
            [method.toLowerCase() as 'post' | 'put' | 'patch' | 'delete'](path)
            .set('Cookie', [`access_token=${TEST_ROLES.complianceReviewer}`])
            .send({});

          expect(response.status).toBe(403);
          expect(response.body.message).toContain('read-only');
        });
      });
    });
  });

  describe('Read Access Allowed', () => {
    it('GET /api/v1/audit with compliance_reviewer should return 200', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('Cookie', [`access_token=${TEST_ROLES.complianceReviewer}`]);

      expect([200, 404]).toContain(response.status); // 200 or 404 if no data
    });
  });
});
