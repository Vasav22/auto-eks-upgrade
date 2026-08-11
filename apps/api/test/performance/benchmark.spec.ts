/**
 * API Performance Benchmark Test Suite (WO-105)
 *
 * Measures endpoint latency under controlled load.
 * Run with: npx jest --testPathPattern=benchmark --runInBand
 * Set PERF_ITERATIONS env var to control number of requests (default 100).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

jest.setTimeout(120_000);

const ITERATIONS = parseInt(process.env['PERF_ITERATIONS'] ?? '50', 10);
const P99_THRESHOLD_MS = 500;
const MEAN_THRESHOLD_MS = 100;

describe('API Performance Benchmarks', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    authToken = 'test-token';
  });

  afterAll(() => app.close());

  async function benchmark(label: string, fn: () => Promise<void>) {
    const timings: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await fn();
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(ITERATIONS * 0.5)];
    const p99 = timings[Math.floor(ITERATIONS * 0.99)];
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;

    console.log(`[BENCH] ${label}: mean=${mean.toFixed(1)}ms p50=${p50.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);

    expect(mean).toBeLessThan(MEAN_THRESHOLD_MS);
    expect(p99).toBeLessThan(P99_THRESHOLD_MS);
  }

  it('GET /api/fleet/status', async () => {
    await benchmark('GET /fleet/status', () =>
      request(app.getHttpServer())
        .get('/api/fleet/status')
        .set('Authorization', `Bearer ${authToken}`)
        .then(),
    );
  });

  it('GET /api/clusters', async () => {
    await benchmark('GET /clusters', () =>
      request(app.getHttpServer())
        .get('/api/clusters?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .then(),
    );
  });

  it('GET /api/compliance/report', async () => {
    await benchmark('GET /compliance/report', () =>
      request(app.getHttpServer())
        .get('/api/compliance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .then(),
    );
  });

  it('GET /metrics endpoint', async () => {
    await benchmark('GET /metrics', () =>
      request(app.getHttpServer())
        .get('/api/metrics')
        .then(),
    );
  });
});
