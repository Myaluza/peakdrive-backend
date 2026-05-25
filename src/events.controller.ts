import { Controller, Get } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    async getAllEvents() {
        return this.eventsService.getAllEvents();
    }
}