import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '../services/jwt.service';
import { SessionService } from '../services/session.service';
import { SessionRepository } from '../repositories/session.repository';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../interfaces/auth.interfaces';
import { AUTH_CONFIG } from '../constants/auth-config';

const AUTH_DISABLED = process.env['DISABLE_AUTH'] === 'true';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
    private sessionRepository: SessionRepository,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (AUTH_DISABLED) {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      request.user = {
        id: 'dev-user',
        oidcSubject: 'dev-user',
        email: 'dev@local',
        displayName: 'Dev User',
        role: 'upgrade_admin' as any,
        idpGroups: [],
      };
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.['access_token'];

    if (!token) {
      this.logger.warn('No access token in request');
      throw new UnauthorizedException({
        error: 'unauthenticated',
        message: 'No access token provided',
      });
    }

    try {
      const payload = await this.jwtService.verifyAccessToken(token);

      // Check absolute session timeout
      // TODO: Get actual session from database by session_id stored in JWT
      // For now, simulate by checking if session created_at exceeds threshold
      const absoluteTimeoutMs = AUTH_CONFIG.ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;
      const sessionAge = Date.now() - (payload.iat * 1000);
      
      if (sessionAge > absoluteTimeoutMs) {
        this.logger.warn(`Session absolute timeout for user ${payload.sub}`);
        throw new UnauthorizedException({
          error: 'SESSION_ABSOLUTE_TIMEOUT',
          message: 'Session expired - maximum session duration exceeded',
        });
      }

      // Attach authenticated user to request
      request.user = {
        id: payload.sub,
        oidcSubject: payload.sub, // TODO: map from proper OIDC subject
        email: payload.email,
        displayName: payload.email,
        role: payload.role as any, // TODO: validate role
        idpGroups: [], // TODO: map from JWT claims
      };

      return true;
    } catch (error: unknown) {
      if ((error as any).error === 'SESSION_ABSOLUTE_TIMEOUT') {
        throw error;
      }
      this.logger.warn(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException({
        error: 'unauthenticated',
        message: 'Invalid or expired access token',
      });
    }
  }
}
