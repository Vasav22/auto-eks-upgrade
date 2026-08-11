import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { WorkersModule } from './workers/workers.module';
import { GatewaysModule } from './gateways/gateways.module';
import { ClusterModule } from './modules/clusters/cluster.module';
import { UpgradeModule } from './modules/upgrades/upgrade.module';
import { NodeGroupModule } from './modules/node-groups/node-group.module';
import { DryRunModule } from './modules/dryrun/dryrun.module';
import { CampaignModule } from './modules/campaigns/campaign.module';
import { HealthModule as EksHealthModule } from './modules/health/health.module';
import { RemediationModule } from './modules/remediation/remediation.module';
import { BackupModule } from './modules/backup/backup.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { IamModule } from './modules/iam/iam.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule.forRoot(),
    HealthModule,
    AuthModule,
    AuditModule,
    WorkersModule,
    GatewaysModule,
    ClusterModule,
    UpgradeModule,
    NodeGroupModule,
    DryRunModule,
    CampaignModule,
    EksHealthModule,
    RemediationModule,
    BackupModule,
    FleetModule,
    SchedulingModule,
    NotificationModule,
    ComplianceModule,
    IamModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
