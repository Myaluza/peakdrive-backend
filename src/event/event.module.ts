import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { HttpModule } from '@nestjs/axios';
import { EventSyncService } from './event-sync.service';
import { AiEnrichmentService } from './ai-enrichment.service';

@Module({
    imports: [HttpModule],
    providers: [EventService, EventSyncService, AiEnrichmentService],
    controllers: [EventController],
    exports: [EventService, EventSyncService]
})
export class EventModule {}