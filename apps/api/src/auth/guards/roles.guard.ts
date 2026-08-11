import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES, RoleName } from '../constants/roles';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PermissionService } from '../services/permission.service';
import { AuditService } from '../../modules/audit/services/audit.service';
import { AuditEventType } from '../../modules/audit/enums/audit-event-type.enum';
import { RequestWithUser } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      this.logger.error('No user in request context - AuthGuard may not be running');
      throw new ForbiddenException({
        error: 'ACCESS_DENIED',
        message: 'No authenticated user',
      });
    }

    // Compliance reviewer write block
    if (
      user.role === ROLES.COMPLIANCE_REVIEWER &&
      this.permissionService.isWriteOperation(request.method)
    ) {
      await this.auditDenial(
        user,
        request,
        'Compliance reviewer attempted write operation',
      );

      throw new ForbiddenException({
        error: 'ACCESS_DENIED',
        message: 'Compliance reviewer role has read-only access',
      });
    }

    // If no specific roles required, allow authenticated request
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Normalize legacy role aliases
    const ROLE_ALIASES: Record<string, string> = {
      admin: ROLES.CLUSTER_ADMIN,
      operator: ROLES.UPGRADE_OPERATOR,
      viewer: ROLES.COMPLIANCE_REVIEWER,
    };
    const normalizedRequired = requiredRoles.map((r) => ROLE_ALIASES[r] ?? r);
    const normalizedUserRole = ROLE_ALIASES[user.role] ?? user.role;

    // Check if user has one of the required roles
    const hasRole = normalizedRequired.includes(normalizedUserRole as RoleName);

    if (!hasRole) {
      await this.auditDenial(
        user,
        request,
        `Required roles: ${requiredRoles.join(', ')}`,
      );

      throw new ForbiddenException({
        error: 'ACCESS_DENIED',
        message: 'Insufficient permissions',
        requiredRoles,
        userRole: user.role,
      });
    }

    return true;
  }

  private async auditDenial(
    user: any,
    request: RequestWithUser,
    reason: string,
  ): Promise<void> {
    try {
      await this.auditService.record({
        actorId: user.id,
        actorRole: user.role,
        action: AuditEventType.AUTH_DENIED,
        resourceType: 'endpoint',
        resourceId: request.path,
        changeDetail: {
          method: request.method,
          path: request.path,
          reason,
          ip_address: request.ip,
          user_agent: request.headers['user-agent'],
        },
      });
    } catch (error: unknown) {
      this.logger.error(`Failed to write audit record: ${(error as Error).message}`);
    }
  }
}
