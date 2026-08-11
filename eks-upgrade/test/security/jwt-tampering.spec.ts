import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { generateTamperedJwt, generateExpiredJwt } from '../helpers/auth-test-helpers';
import { ROLES } from '../../apps/api/src/auth/constants/roles';

describe('JWT Tampering Detection', () => {
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

  describe('Tampered JWT Rejection', () => {
    it('should reject JWT with modified role claim', async () => {
      const tamperedJwt = generateTamperedJwt(ROLES.UPGRADE_OPERATOR);

      const response = await request(app.getHttpServer())
        .get('/api/v1/clusters')
        .set('Cookie', [`access_token=${tamperedJwt}`]);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('unauthenticated');
    });

    it('should reject expired JWT', async () => {
      const expiredJwt = generateExpiredJwt(ROLES.CLUSTER_ADMIN);

      const response = await request(app.getHttpServer())
        .get('/api/v1/clusters')
        .set('Cookie', [`access_token=${expiredJwt}`]);

      expect(response.status).toBe(401);
    });

    it('should reject malformed JWT', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/clusters')
        .set('Cookie', ['access_token=invalid.jwt.token']);

      expect(response.status).toBe(401);
    });
  });

  describe('Missing JWT', () => {
    it('should reject requests without JWT', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/clusters');

      expect(response.status).toBe(401);
    });
  });
});
