import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeGroupEntity } from '../../database/entities/node-group.entity';
import { NodeGroupService } from './services/node-group.service';
import { NodeGroupController } from './controllers/node-group.controller';
import { ClusterModule } from '../clusters/cluster.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NodeGroupEntity]),
    ClusterModule,
    AuditModule,
    AuthModule,
  ],
  providers: [NodeGroupService],
  controllers: [NodeGroupController],
  exports: [NodeGroupService],
})
export class NodeGroupModule {}
