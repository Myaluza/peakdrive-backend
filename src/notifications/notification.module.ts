import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationScheduler } from './notification.scheduler';

@Module({
    providers: [NotificationService, NotificationScheduler],
    exports: [NotificationService]
})
export class NotificationModule {}