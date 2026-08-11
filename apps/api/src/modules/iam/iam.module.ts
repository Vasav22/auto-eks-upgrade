import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsCredentialEntity } from './entities/aws-credential.entity';
import { StsService } from './services/sts.service';
import { CredentialEncryptionService } from './services/credential-encryption.service';
import { CredentialRotationService } from './services/credential-rotation.service';
import { IamController } from './controllers/iam.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([AwsCredentialEntity]), AuditModule],
  controllers: [IamController],
  providers: [StsService, CredentialEncryptionService, CredentialRotationService],
  exports: [StsService, CredentialEncryptionService],
})
export class IamModule {}
