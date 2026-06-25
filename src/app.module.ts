import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { VoucherModule } from './voucher/voucher.module';
import { EventModule } from './event/event.module';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from './notifications/notification.module';
import { NotificationService } from './notifications/notification.service';
import { NotificationScheduler } from './notifications/notification.scheduler';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ConfigModule.forRoot({
            envFilePath: '.env',
        }),
        VoucherModule,
        EventModule,
        AuthModule,
        NotificationModule,
    ],
    controllers: [AppController, EventsController],
    providers: [AppService, EventsService, NotificationService, NotificationScheduler],
})
export class AppModule {}