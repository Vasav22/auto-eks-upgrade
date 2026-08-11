import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PUBLIC_ENDPOINTS } from '../fixtures/security-test-fixtures';

describe('Public Endpoint Access', () => {
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

  describe('Public Endpoints Without JWT', () => {
    PUBLIC_ENDPOINTS.forEach(({ method, path }) => {
      it(`${method} ${path} should be accessible without JWT`, async () => {
        const response = await request(app.getHttpServer())
          [method.toLowerCase() as 'get' | 'post'](path);

        // Should NOT return 401 unauthorized
        expect(response.status).not.toBe(401);
      });
    });
  });

  describe('Protected Endpoints Require JWT', () => {
    it('GET /api/v1/clusters should require JWT', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/clusters');

      expect(response.status).toBe(401);
    });

    it('GET /api/v1/audit should require JWT', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/audit');

      expect(response.status).toBe(401);
    });
  });
});
