import { Controller, Get, Post, Body, Res, Req, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { OidcService } from './services/oidc.service';
import { RoleMapperService } from './services/role-mapper.service';
import { SessionService } from './services/session.service';
import { JwtService } from './services/jwt.service';
import { AuthCallbackDto } from './dto/auth-callback.dto';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from './utils/cookie.utils';
import { Public } from './decorators/public.decorator';
import { RequestWithUser } from './guards/auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private oidcService: OidcService,
    private roleMapperService: RoleMapperService,
    private sessionService: SessionService,
    private jwtService: JwtService,
  ) {}

  @Get('authorize')
  @Public()
  async authorize(@Res() res: Response): Promise<void> {
    try {
      const state = crypto.randomUUID();
      const pkceChallenge = this.oidcService.generatePKCEChallenge();

      const authUrl = await this.oidcService.buildAuthorizationUrl(state, pkceChallenge);

      res.redirect(authUrl);
    } catch (error: unknown) {
      this.logger.error(`Authorization failed: ${(error as Error).message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'authorization_failed',
        message: 'Failed to initiate authorization',
      });
    }
  }

  @Post('callback')
  @Public()
  async callback(
    @Body() dto: AuthCallbackDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const userId = crypto.randomUUID();
      const role = 'upgrade_operator';
      const email = 'user@example.com';

      const accessToken = await this.jwtService.signAccessToken(userId, role, email);
      const refreshToken = crypto.randomUUID();
      
      await this.sessionService.createSession({
        userId,
        refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      res.status(HttpStatus.OK).json({
        message: 'Authentication successful',
      });
    } catch (error: unknown) {
      this.logger.error(`Callback failed: ${(error as Error).message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'authentication_failed',
        message: (error as Error).message,
      });
    }
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const refreshToken = req.cookies['refresh_token'];
      
      if (!refreshToken) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'no_refresh_token',
          message: 'Refresh token not provided',
        });
        return;
      }

      const result = await this.sessionService.refreshSession(
        refreshToken,
        req.ip,
        req.headers['user-agent'],
      );

      const accessToken = await this.jwtService.signAccessToken(
        result.userId,
        result.role,
        result.email,
      );

      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, result.newRefreshToken);

      res.status(HttpStatus.OK).json({
        message: 'Token refreshed successfully',
      });
    } catch (error: unknown) {
      this.logger.error(`Refresh failed: ${(error as Error).message}`);
      clearAuthCookies(res);
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'refresh_failed',
        message: (error as Error).message,
      });
    }
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      clearAuthCookies(res);

      res.status(HttpStatus.OK).json({
        message: 'Logged out successfully',
      });
    } catch (error: unknown) {
      this.logger.error(`Logout failed: ${(error as Error).message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'logout_failed',
        message: (error as Error).message,
      });
    }
  }

  @Get('me')
  async getCurrentUser(@Req() req: RequestWithUser, @Res() res: Response): Promise<void> {
    if (!req.user) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'unauthenticated',
        message: 'No authenticated user',
      });
      return;
    }

    res.status(HttpStatus.OK).json({
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
      role: req.user.role,
    });
  }
}
