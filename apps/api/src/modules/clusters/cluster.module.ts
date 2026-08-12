import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterEntity } from '../../database/entities/cluster.entity';
import { ClusterAccountEntity } from '../../database/entities/cluster-account.entity';
import { ClusterService } from './services/cluster.service';
import { EncryptionService } from './services/encryption.service';
import { VersionService } from './services/version.service';
import { ValidationService } from './services/validation.service';
import { ClusterController } from './controllers/cluster.controller';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClusterEntity, ClusterAccountEntity]),
    AuditModule,
    AuthModule,
  ],
  providers: [ClusterService, EncryptionService, VersionService, ValidationService],
  controllers: [ClusterController],
  exports: [ClusterService, EncryptionService, VersionService, ValidationService],
})
export class ClusterModule {}
