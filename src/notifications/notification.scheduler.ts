import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createClient } from '@supabase/supabase-js';
import { NotificationService } from './notification.service';
import { EventService } from '../event/event.service';
import { EventSyncService } from '../event/event-sync.service';

const CITIES = [
    { id: 'durban', name: 'Durban' }
]

@Injectable()
export class NotificationScheduler {
    private readonly logger = new Logger(NotificationScheduler.name);
    private supabase;

    constructor(
        private readonly notificationService: NotificationService,
        private readonly eventService: EventService,
        private readonly eventSyncService: EventSyncService
    ) {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
    }

    @Cron('0 3 * * *') // runs every day at 3 AM
    async syncAllCities() {
        this.logger.log('Starting daily event sync for all cities...');

        for (const city of CITIES) {
            try {
                this.logger.log(`Syncing ${city.name}...`);
                const events = await this.eventSyncService.fetchEventsForCity(city.id, city.name);

                if (events.length > 0) {
                    await this.eventService.saveExternalEvents(events);
                    this.logger.log(`Synced ${events.length} events for ${city.name}`);
                } else {
                    this.logger.warn(`No events found for ${city.name}`);
                }
            } catch (error) {
                this.logger.error(`Sync failed for ${city.name}: ${(error as any).message}`);
            }
        }

        this.logger.log('Daily event sync complete');
    }

    @Cron('0 0 * * *') // runs every day at midnight
    async runNightlyCleanup() {
        this.logger.log('Running nightly event cleanup...');
        await this.eventService.deleteOldEvents();
    }

    @Cron(CronExpression.EVERY_HOUR)
    async checkUpcomingEvents() {
        this.logger.log('Checking for upcoming high volume events...');

        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const { data: events, error } = await this.supabase
            .from('events')
            .select('id, name, location, date, "finishTime", "expectedVolume"')
            .in('expectedVolume', ['high', 'very high'])
            .gte('date', now.toISOString())
            .lte('date', twoHoursFromNow.toISOString())

        if (error) {
            this.logger.error('Failed to fetch upcoming events:', error.message);
            return;
        }

        if (!events || events.length === 0) {
            this.logger.log('No upcoming high volume events found');
            return;
        }

        this.logger.log(`Found ${events.length} high volume events`);

        const tokens = await this.notificationService.getAllPushTokens();

        for (const event of events) {
            const title = '🚗 Surge Alert — PeakDrive';
            const body = `High demand expected near ${event.location} at ${event.finishTime}. Position yourself now!`;
            await this.notificationService.sendPushNotifications(tokens, title, body);
            this.logger.log(`Notification sent for event: ${event.name}`);
        }
    }
}