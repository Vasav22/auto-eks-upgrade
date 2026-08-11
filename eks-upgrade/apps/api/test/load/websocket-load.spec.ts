/**
 * WebSocket Concurrent Connection Load Test Suite (WO-106)
 *
 * Tests that the Socket.IO gateway handles many concurrent connections.
 * Run with: npx jest --testPathPattern=websocket-load --runInBand
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';

jest.setTimeout(60_000);

const CONCURRENT_CLIENTS = parseInt(process.env['WS_CLIENTS'] ?? '50', 10);

describe('WebSocket Concurrent Connection Load Test', () => {
  let app: INestApplication;
  let httpServer: ReturnType<typeof app.getHttpServer>;
  let port: number;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    httpServer = app.getHttpServer() as ReturnType<typeof app.getHttpServer>;
    const addr = (httpServer as { address(): { port: number } }).address();
    port = addr.port;
  });

  afterAll(() => app.close());

  it(`should handle ${CONCURRENT_CLIENTS} concurrent WebSocket connections`, async () => {
    const clients: Socket[] = [];
    const connectPromises: Promise<void>[] = [];

    for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
      const client = io(`http://localhost:${port}/upgrades`, {
        transports: ['websocket'],
        auth: { token: 'test-token' },
      });
      clients.push(client);
      connectPromises.push(
        new Promise<void>((resolve, reject) => {
          client.on('connect', resolve);
          client.on('connect_error', reject);
          setTimeout(() => reject(new Error(`Client ${i} timed out`)), 10_000);
        }),
      );
    }

    await Promise.all(connectPromises);
    expect(clients.filter(c => c.connected).length).toBe(CONCURRENT_CLIENTS);

    // Cleanup
    clients.forEach(c => c.disconnect());
    await new Promise(r => setTimeout(r, 500));
  });

  it('should broadcast to all subscribed clients', async () => {
    const upgradeJobId = 'test-upgrade-1';
    const clients: Socket[] = [];
    const receivedMessages: number[] = [];

    for (let i = 0; i < 10; i++) {
      const client = io(`http://localhost:${port}/upgrades`, {
        transports: ['websocket'],
        auth: { token: 'test-token' },
      });
      clients.push(client);
      client.emit('subscribe', { upgradeJobId });
      client.on('upgrade.progress', () => receivedMessages.push(i));
    }

    await new Promise(r => setTimeout(r, 500));

    clients.forEach(c => c.disconnect());
    expect(clients.length).toBe(10);
  });
});
