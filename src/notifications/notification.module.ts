import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationScheduler } from './notification.scheduler';
import { EventModule } from '../event/event.module';

@Module({
    imports: [EventModule],
    providers: [NotificationService, NotificationScheduler],
    exports: [NotificationService]
})
export class NotificationModule {}