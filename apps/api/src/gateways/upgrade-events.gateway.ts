import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface MessageHistory {
  id: string;
  event: string;
  data: any;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] || '*',
    credentials: true,
  },
  namespace: '/upgrades',
})
export class UpgradeEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UpgradeEventsGateway.name);
  private readonly MESSAGE_HISTORY_TTL = 300; // 5 minutes
  private readonly MAX_HISTORY_SIZE = 1000;
  private messageHistory: Map<string, MessageHistory[]> = new Map();

  constructor(private readonly redisService: RedisService) {}

  async handleConnection(client: Socket) {
    const clientId = client.id;
    this.logger.log(`Client connected: ${clientId}`);
    this.messageHistory.set(clientId, []);

    client.emit('connected', {
      clientId,
      timestamp: Date.now(),
      message: 'Connected to upgrade events stream',
    });
  }

  async handleDisconnect(client: Socket) {
    const clientId = client.id;
    this.logger.log(`Client disconnected: ${clientId}`);

    // Clean up history after TTL
    setTimeout(() => {
      this.messageHistory.delete(clientId);
    }, this.MESSAGE_HISTORY_TTL * 1000);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { upgradeJobId?: string; clusterId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.upgradeJobId) {
      client.join(`upgrade:${data.upgradeJobId}`);
      this.logger.log(
        `Client ${client.id} subscribed to upgrade:${data.upgradeJobId}`,
      );
      client.emit('subscribed', {
        upgradeJobId: data.upgradeJobId,
        timestamp: Date.now(),
      });
    }

    if (data.clusterId) {
      client.join(`cluster:${data.clusterId}`);
      this.logger.log(
        `Client ${client.id} subscribed to cluster:${data.clusterId}`,
      );
      client.emit('subscribed', {
        clusterId: data.clusterId,
        timestamp: Date.now(),
      });
    }

    return { success: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { upgradeJobId?: string; clusterId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.upgradeJobId) {
      client.leave(`upgrade:${data.upgradeJobId}`);
      this.logger.log(
        `Client ${client.id} unsubscribed from upgrade:${data.upgradeJobId}`,
      );
    }

    if (data.clusterId) {
      client.leave(`cluster:${data.clusterId}`);
      this.logger.log(
        `Client ${client.id} unsubscribed from cluster:${data.clusterId}`,
      );
    }

    return { success: true };
  }

  @SubscribeMessage('REQUEST_GAP_FILL')
  handleGapFill(
    @MessageBody() data: { lastMessageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const history = this.messageHistory.get(client.id) || [];
    const lastIndex = history.findIndex((msg) => msg.id === data.lastMessageId);

    if (lastIndex === -1) {
      // Can't find last message, send all recent history
      client.emit('GAP_FILL', {
        messages: history,
        complete: false,
      });
      return { success: true, messagesCount: history.length };
    }

    const missedMessages = history.slice(lastIndex + 1);
    client.emit('GAP_FILL', {
      messages: missedMessages,
      complete: true,
    });

    this.logger.log(
      `Gap fill sent ${missedMessages.length} messages to client ${client.id}`,
    );

    return { success: true, messagesCount: missedMessages.length };
  }

  async emitUpgradeEvent(upgradeJobId: string, event: string, data: any) {
    const messageId = `${upgradeJobId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: MessageHistory = {
      id: messageId,
      event,
      data,
      timestamp: Date.now(),
    };

    // Store in history for all connected clients
    this.messageHistory.forEach((history, clientId) => {
      history.push(message);
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.shift(); // Remove oldest
      }
    });

    // Emit to subscribed clients
    this.server.to(`upgrade:${upgradeJobId}`).emit(event, {
      ...data,
      messageId,
      timestamp: message.timestamp,
    });

    // Also publish to Redis for multi-instance support
    const redis = await this.redisService.getClient();
    await redis.publish(
      `upgrade-events:${upgradeJobId}`,
      JSON.stringify({
        event,
        data,
        messageId,
        timestamp: message.timestamp,
      }),
    );

    this.logger.debug(
      `Emitted ${event} for upgrade ${upgradeJobId} to ${this.server.sockets.adapter.rooms.get(`upgrade:${upgradeJobId}`)?.size || 0} clients`,
    );
  }

  async emitClusterEvent(clusterId: string, event: string, data: any) {
    const messageId = `${clusterId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: MessageHistory = {
      id: messageId,
      event,
      data,
      timestamp: Date.now(),
    };

    // Store in history
    this.messageHistory.forEach((history) => {
      history.push(message);
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.shift();
      }
    });

    this.server.to(`cluster:${clusterId}`).emit(event, {
      ...data,
      messageId,
      timestamp: message.timestamp,
    });

    const redis = await this.redisService.getClient();
    await redis.publish(
      `cluster-events:${clusterId}`,
      JSON.stringify({
        event,
        data,
        messageId,
        timestamp: message.timestamp,
      }),
    );
  }
}
