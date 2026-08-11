import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { OidcService } from './services/oidc.service';
import { RoleMapperService } from './services/role-mapper.service';
import { JwtService } from './services/jwt.service';
import { SessionService } from './services/session.service';
import { PermissionService } from './services/permission.service';
import { LockoutService } from './services/lockout.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { AuthController } from './auth.controller';
import { Session } from './entities/session.entity';
import { SessionRepository } from './repositories/session.repository';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { IdleTimeoutMiddleware } from './middleware/idle-timeout.middleware';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Session])],
  controllers: [AuthController],
  providers: [
    OidcService,
    RoleMapperService,
    JwtService,
    SessionService,
    SessionRepository,
    PermissionService,
    LockoutService,
    RateLimiterService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [
    OidcService,
    RoleMapperService,
    JwtService,
    SessionService,
    PermissionService,
    LockoutService,
    RateLimiterService,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting to all auth endpoints
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: 'api/v1/auth/*', method: RequestMethod.ALL });

    // Apply idle timeout to all authenticated endpoints
    consumer
      .apply(IdleTimeoutMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });
  }
}
