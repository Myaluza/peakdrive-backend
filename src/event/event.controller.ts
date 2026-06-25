import { Controller, Get, Param, BadRequestException, Post, Body } from '@nestjs/common';
import { EventService } from './event.service';
import { EventSyncService } from './event-sync.service';

const CITY_NAMES: Record<string, string> = {
    durban: 'Durban',
    johannesburg: 'Johannesburg',
    'cape-town': 'Cape Town',
    pretoria: 'Pretoria'
}

@Controller('event')
export class EventController {
    constructor(
        private readonly eventService: EventService,
        private readonly eventSyncService: EventSyncService
    ) {}

    @Post(':cityId/sync')
    async syncCityEvents(@Param('cityId') cityId: string) {
        if (!cityId || cityId.trim() === '') {
            throw new BadRequestException('City ID parameter is required')
        }

        const cityName = CITY_NAMES[cityId.toLowerCase()]
        if (!cityName) {
            throw new BadRequestException(`Unknown city: ${cityId}. Valid options: ${Object.keys(CITY_NAMES).join(', ')}`)
        }

        const enrichedEvents = await this.eventSyncService.fetchEventsForCity(cityId, cityName)

        if (enrichedEvents.length === 0) {
            return { message: 'Sync completed. No new events found.', count: 0 }
        }

        const savedRecords = await this.eventService.saveExternalEvents(enrichedEvents)

        return {
            message: `Successfully synced events for ${cityName}`,
            count: savedRecords?.length || 0
        }
    }

    @Get(':cityId')
    async getEvents(@Param('cityId') cityId: string) {
        if (!cityId || cityId.trim() === '') {
            throw new BadRequestException('City ID parameter is required')
        }
        return this.eventService.getEventsByCity(cityId)
    }
}