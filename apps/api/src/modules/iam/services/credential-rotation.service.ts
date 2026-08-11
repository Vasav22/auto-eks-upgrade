/**
 * Credential rotation enforcement service (WO-100).
 *
 * Runs a daily cron that:
 * 1. Identifies credentials past their rotation interval.
 * 2. Marks them INVALID so the STS service will refuse to issue sessions.
 * 3. Emits an audit event so operators know which accounts need attention.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AwsCredentialEntity } from '../entities/aws-credential.entity';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';

@Injectable()
export class CredentialRotationService {
  private readonly logger = new Logger(CredentialRotationService.name);

  constructor(
    @InjectRepository(AwsCredentialEntity)
    private readonly credentialRepo: Repository<AwsCredentialEntity>,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async enforceRotation(): Promise<void> {
    this.logger.log('Running daily credential rotation enforcement check');
    const overdue = await this.findOverdueCredentials();

    for (const cred of overdue) {
      this.logger.warn(
        `Credential for account ${cred.accountId} is overdue for rotation (interval: ${cred.rotationIntervalDays}d)`,
      );

      await this.credentialRepo.update(cred.id, {
        validationStatus: 'INVALID',
        validationMessage: `Credential rotation overdue (${cred.rotationIntervalDays}d interval exceeded). Please rotate the IAM role ARN.`,
        validatedAt: new Date(),
      });

      await this.auditService.record({
        type: AuditEventType.DATA_MUTATION,
        actorId: 'system',
        targetType: 'aws_credential',
        targetId: cred.id,
        metadata: {
          event: 'credential_rotation_overdue',
          accountId: cred.accountId,
          rotationIntervalDays: cred.rotationIntervalDays,
          lastRotatedAt: cred.lastRotatedAt?.toISOString() ?? null,
        },
      });
    }

    if (overdue.length > 0) {
      this.logger.warn(`${overdue.length} credential(s) marked invalid due to overdue rotation`);
    } else {
      this.logger.log('All credentials within rotation interval');
    }
  }

  async findOverdueCredentials(): Promise<AwsCredentialEntity[]> {
    const all = await this.credentialRepo.find({ where: { isActive: true } });
    const now = new Date();
    return all.filter(c => {
      if (!c.lastRotatedAt) return true;
      const daysSince = (now.getTime() - c.lastRotatedAt.getTime()) / (1000 * 86400);
      return daysSince >= c.rotationIntervalDays;
    });
  }

  async markRotated(accountId: string, actorId: string): Promise<AwsCredentialEntity> {
    const cred = await this.credentialRepo.findOneOrFail({ where: { accountId } });
    cred.lastRotatedAt = new Date();
    cred.validationStatus = 'UNKNOWN';
    cred.validationMessage = undefined;
    await this.credentialRepo.save(cred);

    await this.auditService.record({
      type: AuditEventType.DATA_MUTATION,
      actorId,
      targetType: 'aws_credential',
      targetId: cred.id,
      metadata: { event: 'credential_rotated', accountId },
    });

    return cred;
  }
}
