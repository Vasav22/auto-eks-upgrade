import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationChannelEntity } from './entities/notification-channel.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationService } from './services/notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationChannelEntity, NotificationEntity])],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
