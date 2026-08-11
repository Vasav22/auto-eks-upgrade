import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Session } from '../entities/session.entity';
import { SessionRepository } from '../repositories/session.repository';

export interface CreateSessionParams {
  userId: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshResult {
  newAccessToken: string;
  newRefreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly REFRESH_TOKEN_TTL_HOURS = 8;

  constructor(private sessionRepository: SessionRepository) {}

  async createSession(params: CreateSessionParams): Promise<Session> {
    const tokenHash = await bcrypt.hash(params.refreshToken, 10);
    const tokenFamily = crypto.randomUUID();

    const session = new Session();
    session.user_id = params.userId;
    session.token_family = tokenFamily;
    session.refresh_token_hash = tokenHash;
    session.is_used = false;
    session.is_revoked = false;
    session.expires_at = new Date(
      Date.now() + this.REFRESH_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );
    session.ip_address = params.ipAddress ?? null;
    session.user_agent = params.userAgent ?? null;

    const saved = await this.sessionRepository.save(session);
    this.logger.log(`Session created: ${saved.id} for user ${params.userId}`);
    return saved;
  }

  async refreshSession(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefreshResult & { userId: string; role: string; email: string; tokenFamily: string }> {
    // TODO: Implement full refresh logic
    // 1. Find session by token hash
    // 2. Check if already used (replay detection)
    // 3. If used, invalidate entire token family (compromise detected)
    // 4. Check expiry
    // 5. Mark old session as used
    // 6. Create new session in same token family
    // 7. Return new tokens

    throw new Error('Not yet implemented');
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.is_revoked = true;
    await this.sessionRepository.save(session);
    this.logger.log(`Session revoked: ${sessionId}`);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.invalidateAllUserSessions(userId);
    this.logger.warn(`All sessions revoked for user ${userId}`);
  }

  async isSessionValid(session: Session): Promise<boolean> {
    if (session.is_revoked) {
      return false;
    }

    if (session.is_used) {
      return false;
    }

    if (session.expires_at < new Date()) {
      return false;
    }

    return true;
  }

  async verifyRefreshToken(
    refreshToken: string,
    tokenHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(refreshToken, tokenHash);
  }
}
