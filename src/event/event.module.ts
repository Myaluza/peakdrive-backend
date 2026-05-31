import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { HttpModule } from '@nestjs/axios';
import { EventSyncService } from './event-sync.service';

@Module({
  imports: [HttpModule],
  providers: [EventService, EventSyncService],
  controllers: [EventController]
})
export class EventModule {}
