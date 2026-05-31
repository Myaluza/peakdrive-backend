import { Controller, Get, Param, BadRequestException, UseGuards, Post, Body } from '@nestjs/common';
import { EventService } from './event.service';
import { AuthGuard } from '@nestjs/passport';
import { EventSyncService } from './event-sync.service';

@Controller('event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly eventSyncService: EventSyncService
  ) {}

  @Post(':cityId/sync')
  async syncCityEvents(
    @Param('cityId') cityId: string,
    @Body('feedUrl') feedUrl: string
  ) {
    if (!cityId || cityId.trim() === '') {
      throw new BadRequestException('City ID parameter is required')
    }
    if (!feedUrl || feedUrl.trim() === '') {
      throw new BadRequestException('Feed URL is required in request body')
    }

    const cleanEvents = await this.eventSyncService.fetchRSSFeed(feedUrl, cityId)

    if (cleanEvents.length === 0) {
      return { message: 'Sync cycle completed. No new events found or feed unreachable.', count: 0 }
    }

    const savedRecords = await this.eventService.saveExternalEvents(cleanEvents)

    return {
      message: `Successfully synchronized events for city: ${cityId}`,
      count: savedRecords?.length || 0
    };
  }

  @Get(':cityId')
  async getEvents(@Param('cityId') cityId: string) {

    if (!cityId || cityId.trim() === '') {
      throw new BadRequestException('City ID parameter is required');
    }

    return this.eventService.getEventsByCity(cityId);
  }
}