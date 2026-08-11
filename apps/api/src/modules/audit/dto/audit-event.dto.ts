import {
  IsString,
  IsUUID,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
} from 'class-validator';
import { AuditEventType } from '../enums/audit-event-type.enum';

export class AuditEventDto {
  @IsUUID()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  actorRole!: string;

  @IsEnum(AuditEventType)
  @IsNotEmpty()
  action!: AuditEventType;

  @IsString()
  @IsNotEmpty()
  resourceType!: string;

  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsObject()
  @IsNotEmpty()
  changeDetail!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  approvalChain?: Record<string, unknown> | null;

  @IsUUID()
  @IsOptional()
  requestId?: string | null;
}
