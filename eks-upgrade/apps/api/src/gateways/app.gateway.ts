import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log({
      msg: 'Client connected',
      clientId: client.id,
      event: 'connection',
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log({
      msg: 'Client disconnected',
      clientId: client.id,
      event: 'disconnection',
    });
  }
}
