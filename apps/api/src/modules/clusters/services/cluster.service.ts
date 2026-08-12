import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ClusterEntity } from '../../../database/entities/cluster.entity';
import { ClusterAccountEntity } from '../../../database/entities/cluster-account.entity';
import { RegisterAccountDto } from '../dto/register-account.dto';
import { DiscoverClustersDto } from '../dto/discover-clusters.dto';
import { ClusterDetailDto } from '../dto/cluster-detail.dto';
import { AuditService } from '../../audit/services/audit.service';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { EncryptionService } from './encryption.service';
import { VersionService } from './version.service';
import {
  EKS,
  ListClustersCommand,
  DescribeClusterCommand,
} from '@aws-sdk/client-eks';
import { STS, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { v4 as uuidv4 } from 'uuid';

export interface ClusterDiscoveryResult {
  accountId: string;
  discovered: number;
  registered: number;
  updated: number;
  errors: string[];
}

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);

  constructor(
    @InjectRepository(ClusterAccountEntity)
    private readonly accountRepository: Repository<ClusterAccountEntity>,
    @InjectRepository(ClusterEntity)
    private readonly clusterRepository: Repository<ClusterEntity>,
    private readonly auditService: AuditService,
    private readonly encryptionService: EncryptionService,
    private readonly versionService: VersionService,
  ) {}

  async registerAccount(
    dto: RegisterAccountDto,
    actorId: string,
  ): Promise<ClusterAccountEntity> {
    const encrypted = this.encryptionService.encrypt(
      JSON.stringify({
        accessKeyId: dto.accessKeyId,
        secretAccessKey: dto.secretAccessKey,
        roleArn: dto.roleArn,
        externalId: dto.externalId,
      }),
    );

    let account = await this.accountRepository.findOne({
      where: { accountName: dto.accountName },
    });

    if (account) {
      account.encryptedCredentials = encrypted.ciphertext;
      account.credentialsNonce = encrypted.nonce;
      account.credentialsTag = encrypted.tag;
      account.defaultRegion = dto.defaultRegion || 'us-east-1';
      account = await this.accountRepository.save(account);

      await this.auditService.record({
        action: AuditEventType.CLUSTER_ACCOUNT_UPDATED,
        actorId,
        actorRole: 'cluster_admin',
        resourceType: 'cluster_account',
        resourceId: account.id,
        changeDetail: { accountName: dto.accountName },
      });

      this.logger.log(
        `Updated cluster account: ${dto.accountName} (${account.id})`,
      );
    } else {
      account = this.accountRepository.create({
        accountName: dto.accountName,
        encryptedCredentials: encrypted.ciphertext,
        credentialsNonce: encrypted.nonce,
        credentialsTag: encrypted.tag,
        defaultRegion: dto.defaultRegion || 'us-east-1',
      });
      account = await this.accountRepository.save(account);

      await this.auditService.record({
        action: AuditEventType.CLUSTER_ACCOUNT_REGISTERED,
        actorId,
        actorRole: 'cluster_admin',
        resourceType: 'cluster_account',
        resourceId: account.id,
        changeDetail: { accountName: dto.accountName },
      });

      this.logger.log(
        `Registered new cluster account: ${dto.accountName} (${account.id})`,
      );
    }

    return account;
  }

  async discoverClusters(
    dto: DiscoverClustersDto,
    actorId: string,
  ): Promise<ClusterDiscoveryResult> {
    const account = await this.accountRepository.findOne({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(
        `Cluster account with ID ${dto.accountId} not found`,
      );
    }

    const credentials = JSON.parse(
      this.encryptionService.decrypt({
        ciphertext: account.encryptedCredentials,
        nonce: account.credentialsNonce,
        tag: account.credentialsTag,
      }),
    );

    const regions =
      dto.regions && dto.regions.length > 0
        ? dto.regions
        : this.getAllEksRegions();
    const result: ClusterDiscoveryResult = {
      accountId: account.id,
      discovered: 0,
      registered: 0,
      updated: 0,
      errors: [],
    };

    // Scan regions in parallel, 5 at a time, to avoid EKS rate limits
    const CONCURRENCY = 5;
    for (let i = 0; i < regions.length; i += CONCURRENCY) {
      const batch = regions.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (region) => {
          try {
            await this.discoverClustersInRegion(
              account,
              region,
              credentials,
              actorId,
              result,
            );
          } catch (error) {
            const errorMessage = `Failed to discover clusters in ${region}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errorMessage);
            this.logger.error(errorMessage);
          }
        }),
      );
    }

    await this.auditService.record({
      action: AuditEventType.CLUSTER_DISCOVERY_COMPLETED,
      actorId,
      actorRole: 'cluster_admin',
      resourceType: 'cluster_account',
      resourceId: account.id,
      changeDetail: {
        regions,
        discovered: result.discovered,
        registered: result.registered,
        updated: result.updated,
        errors: result.errors.length,
      },
    });

    return result;
  }

  /** All AWS commercial regions where EKS is available. */
  private getAllEksRegions(): string[] {
    return [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'ca-central-1', 'ca-west-1',
      'eu-west-1', 'eu-west-2', 'eu-west-3',
      'eu-central-1', 'eu-central-2',
      'eu-north-1', 'eu-south-1', 'eu-south-2',
      'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
      'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
      'ap-south-1', 'ap-south-2',
      'ap-east-1',
      'me-south-1', 'me-central-1',
      'sa-east-1',
      'af-south-1',
      'il-central-1',
    ];
  }

  private async discoverClustersInRegion(
    account: ClusterAccountEntity,
    region: string,
    credentials: any,
    actorId: string,
    result: ClusterDiscoveryResult,
  ): Promise<void> {
    const awsCredentials = await this.getAwsCredentials(
      credentials,
      region,
    );

    const eksConfig: any = { region };
    if (awsCredentials) {
      eksConfig.credentials = awsCredentials;
    }
    const eks = new EKS(eksConfig);

    const listCommand = new ListClustersCommand({});
    const listResponse = await eks.send(listCommand);

    if (!listResponse.clusters || listResponse.clusters.length === 0) {
      this.logger.log(`No clusters found in ${region} for account ${account.accountName}`);
      return;
    }

    for (const clusterName of listResponse.clusters) {
      try {
        const describeCommand = new DescribeClusterCommand({
          name: clusterName,
        });
        const describeResponse = await eks.send(describeCommand);

        if (!describeResponse.cluster) {
          continue;
        }

        const clusterData = describeResponse.cluster;
        result.discovered++;

        let cluster = await this.clusterRepository.findOne({
          where: {
            account: { id: account.id },
            clusterName: clusterName,
            region: region,
          },
          relations: ['account'],
        });

        if (cluster) {
          cluster.clusterArn = clusterData.arn || cluster.clusterArn;
          cluster.currentVersion = clusterData.version || cluster.currentVersion;
          cluster.status = (clusterData.status as any) || cluster.status;
          cluster.endpoint = clusterData.endpoint || cluster.endpoint;
          cluster.lastSyncedAt = new Date();
          await this.clusterRepository.save(cluster);
          result.updated++;

          this.logger.log(
            `Updated cluster: ${clusterName} in ${region} (${cluster.id})`,
          );
        } else {
          cluster = this.clusterRepository.create({
            account,
            clusterName: clusterName,
            clusterArn: clusterData.arn || '',
            region: region,
            currentVersion: clusterData.version || 'unknown',
            status: (clusterData.status as any) || 'UNKNOWN',
            endpoint: clusterData.endpoint || null,
            lastSyncedAt: new Date(),
          });
          await this.clusterRepository.save(cluster);
          result.registered++;

          await this.auditService.record({
            action: AuditEventType.CLUSTER_DISCOVERED,
            actorId,
            actorRole: 'cluster_admin',
            resourceType: 'cluster',
            resourceId: cluster.id,
            changeDetail: {
              clusterName: clusterName,
              region: region,
              eksVersion: cluster.eksVersion,
            },
          });

          this.logger.log(
            `Registered new cluster: ${clusterName} in ${region} (${cluster.id})`,
          );
        }
      } catch (error) {
        const errorMessage = `Failed to process cluster ${clusterName}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        this.logger.error(errorMessage);
      }
    }
  }

  private async getAwsCredentials(
    credentials: any,
    region: string,
  ): Promise<any> {
    if (credentials.roleArn) {
      // Determine the current account so we can skip role chaining for same-account roles.
      // When the role is in the same account as the pod's IRSA identity, the pod already
      // has direct EKS permissions — no need to assume an intermediate role.
      const podAccountId = await this.getPodAccountId(region);
      const roleAccountId = credentials.roleArn.split(':')[4];

      if (podAccountId && podAccountId === roleAccountId && !credentials.accessKeyId) {
        this.logger.log(
          `Same-account role ${credentials.roleArn} — using ambient IRSA credentials directly`,
        );
        return undefined; // AWS SDK uses the default provider chain (IRSA)
      }

      // Cross-account: assume the role using ambient credentials (or provided static keys).
      const stsConfig: any = { region };
      if (credentials.accessKeyId && credentials.secretAccessKey) {
        stsConfig.credentials = {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        };
      }
      const sts = new STS(stsConfig);

      const assumeCommand = new AssumeRoleCommand({
        RoleArn: credentials.roleArn,
        RoleSessionName: `eks-upgrade-discovery-${Date.now()}`,
        DurationSeconds: 3600,
        ...(credentials.externalId && { ExternalId: credentials.externalId }),
      });

      const assumeResponse = await sts.send(assumeCommand);

      if (!assumeResponse.Credentials) {
        throw new Error('Failed to assume role');
      }

      return {
        accessKeyId: assumeResponse.Credentials.AccessKeyId!,
        secretAccessKey: assumeResponse.Credentials.SecretAccessKey!,
        sessionToken: assumeResponse.Credentials.SessionToken!,
      };
    }

    // Static keys provided — use them directly
    if (credentials.accessKeyId && credentials.secretAccessKey) {
      return {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      };
    }

    // No credentials at all — return undefined so AWS SDK uses the default provider chain
    return undefined;
  }

  private async getPodAccountId(region: string): Promise<string | null> {
    try {
      const sts = new STS({ region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      return identity.Account ?? null;
    } catch {
      return null;
    }
  }

  async getAccountById(id: string): Promise<ClusterAccountEntity> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Cluster account with ID ${id} not found`);
    }
    return account;
  }

  async listAccounts(): Promise<ClusterAccountEntity[]> {
    return this.accountRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getClusterById(id: string): Promise<ClusterEntity> {
    const cluster = await this.clusterRepository.findOne({
      where: { id },
      relations: ['account'],
    });
    if (!cluster) {
      throw new NotFoundException(`Cluster with ID ${id} not found`);
    }
    return cluster;
  }

  async getClusterDetail(id: string): Promise<ClusterDetailDto> {
    const cluster = await this.getClusterById(id);
    const versionInfo = cluster.eksVersion
      ? this.versionService.computeEligibleVersions(cluster.eksVersion)
      : null;
    return ClusterDetailDto.fromEntity(cluster, versionInfo);
  }

  async listClusters(accountId?: string): Promise<ClusterEntity[]> {
    if (accountId) {
      return this.clusterRepository.find({
        where: { account: { id: accountId } },
        relations: ['account'],
        order: { lastSyncedAt: 'DESC' },
      });
    }
    return this.clusterRepository.find({
      relations: ['account'],
      order: { lastSyncedAt: 'DESC' },
    });
  }
}
