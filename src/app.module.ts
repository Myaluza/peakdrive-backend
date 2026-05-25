import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '.env',
        }),
    ],
    controllers: [AppController, EventsController],
    providers: [AppService, EventsService],
})
export class AppModule {}