import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { VoucherModule } from './voucher/voucher.module';
import { EventModule } from './event/event.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
        }),
        VoucherModule,
        EventModule,
    ],
    controllers: [AppController, EventsController],
    providers: [AppService, EventsService],
})
export class AppModule {}