import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AwsCredentialEntity } from '../entities/aws-credential.entity';
import { CredentialEncryptionService } from './credential-encryption.service';

export interface AssumedRoleSession {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
  accountId: string;
}

const SESSION_DURATION_SECONDS = 3600;
const CACHE_BUFFER_SECONDS = 300;

@Injectable()
export class StsService {
  private readonly logger = new Logger(StsService.name);
  private readonly sessionCache = new Map<string, AssumedRoleSession>();

  constructor(
    @InjectRepository(AwsCredentialEntity)
    private readonly credentialRepo: Repository<AwsCredentialEntity>,
    private readonly config: ConfigService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  async assumeRole(accountId: string): Promise<AssumedRoleSession> {
    const cached = this.sessionCache.get(accountId);
    if (cached && cached.expiration.getTime() > Date.now() + CACHE_BUFFER_SECONDS * 1000) {
      this.logger.debug(`Returning cached session for account ${accountId}`);
      return cached;
    }

    const credential = await this.credentialRepo.findOne({ where: { accountId, isActive: true } });
    if (!credential) {
      throw new UnauthorizedException(`No active credential configured for account ${accountId}`);
    }

    const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
    const client = new STSClient({ region: this.config.get('AWS_REGION', 'us-east-1') });

    const decryptedRoleArn = this.encryption.decrypt(credential.roleArn);
    const decryptedExternalId = credential.externalId
      ? this.encryption.decrypt(credential.externalId)
      : undefined;

    const assumeParams: { RoleArn: string; RoleSessionName: string; DurationSeconds: number; ExternalId?: string } = {
      RoleArn: decryptedRoleArn,
      RoleSessionName: `eks-upgrade-${Date.now()}`,
      DurationSeconds: SESSION_DURATION_SECONDS,
    };

    if (decryptedExternalId) {
      assumeParams.ExternalId = decryptedExternalId;
    }

    const result = await client.send(new AssumeRoleCommand(assumeParams));

    if (!result.Credentials?.AccessKeyId || !result.Credentials.SecretAccessKey || !result.Credentials.SessionToken) {
      throw new Error('STS returned incomplete credentials');
    }

    const session: AssumedRoleSession = {
      accessKeyId: result.Credentials.AccessKeyId,
      secretAccessKey: result.Credentials.SecretAccessKey,
      sessionToken: result.Credentials.SessionToken,
      expiration: result.Credentials.Expiration ?? new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
      accountId,
    };

    this.sessionCache.set(accountId, session);
    await this.credentialRepo.update(credential.id, { lastAssumedAt: new Date() });

    this.logger.log(`Assumed role for account ${accountId} (expires ${session.expiration.toISOString()})`);
    return session;
  }

  async validateCredential(accountId: string): Promise<{ valid: boolean; message: string; callerArn?: string }> {
    try {
      const session = await this.assumeRole(accountId);
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const client = new STSClient({
        region: this.config.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: session.accessKeyId,
          secretAccessKey: session.secretAccessKey,
          sessionToken: session.sessionToken,
        },
      });
      const identity = await client.send(new GetCallerIdentityCommand({}));

      await this.credentialRepo.update(
        { accountId },
        {
          validationStatus: 'VALID',
          validationMessage: `Caller: ${identity.Arn}`,
          validatedAt: new Date(),
        },
      );

      return { valid: true, message: 'Credentials valid', callerArn: identity.Arn };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      await this.credentialRepo.update(
        { accountId },
        {
          validationStatus: 'INVALID',
          validationMessage: message,
          validatedAt: new Date(),
        },
      );
      return { valid: false, message };
    }
  }

  invalidateSession(accountId: string) {
    this.sessionCache.delete(accountId);
  }

  async upsertCredential(dto: {
    accountId: string;
    accountAlias?: string;
    roleArn: string;
    externalId?: string;
    rotationIntervalDays?: number;
  }): Promise<AwsCredentialEntity> {
    const encrypted = {
      ...dto,
      roleArn: this.encryption.encrypt(dto.roleArn),
      externalId: dto.externalId ? this.encryption.encrypt(dto.externalId) : undefined,
    };
    const existing = await this.credentialRepo.findOne({ where: { accountId: dto.accountId } });
    if (existing) {
      Object.assign(existing, encrypted);
      existing.validationStatus = 'UNKNOWN';
      this.invalidateSession(dto.accountId);
      return this.credentialRepo.save(existing);
    }
    const entity = this.credentialRepo.create({ ...encrypted, validationStatus: 'UNKNOWN' });
    return this.credentialRepo.save(entity);
  }

  async listCredentials(): Promise<AwsCredentialEntity[]> {
    return this.credentialRepo.find({ order: { accountId: 'ASC' } });
  }

  async checkRotationDue(): Promise<AwsCredentialEntity[]> {
    const all = await this.credentialRepo.find({ where: { isActive: true } });
    const now = new Date();
    return all.filter(c => {
      if (!c.lastRotatedAt) return true;
      const daysSince = (now.getTime() - c.lastRotatedAt.getTime()) / (1000 * 86400);
      return daysSince >= c.rotationIntervalDays;
    });
  }
}
