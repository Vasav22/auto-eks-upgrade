import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private signingKey: string | null = null;

  constructor(private configService: ConfigService) {}

  async loadSigningKey(): Promise<string> {
    if (this.signingKey) {
      return this.signingKey;
    }

    // TODO: Load from AWS Secrets Manager with dual-key rotation support
    const key = this.configService.get<string>('JWT_SIGNING_KEY') ?? 'dev-secret-key';
    this.signingKey = key;
    this.logger.log('JWT signing key loaded');
    return key;
  }

  async signAccessToken(userId: string, role: string, email: string): Promise<string> {
    const key = await this.loadSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 15 * 60; // 15 minutes

    const payload: JwtPayload = {
      sub: userId,
      role,
      email,
      iat: now,
      exp: expiry,
    };

    return jwt.sign(payload, key, { algorithm: 'HS256' });
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const key = await this.loadSigningKey();
    
    try {
      const decoded = jwt.verify(token, key, {
        algorithms: ['HS256'],
        clockTolerance: 30, // 30 seconds
      }) as JwtPayload;

      return decoded;
    } catch (error: unknown) {
      this.logger.warn(`JWT verification failed: ${(error as Error).message}`);
      throw new Error('Invalid or expired token');
    }
  }
}
