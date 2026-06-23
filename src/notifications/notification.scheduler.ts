import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createClient } from '@supabase/supabase-js';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationScheduler {
    private readonly logger = new Logger(NotificationScheduler.name);
    private supabase;

    constructor(private readonly notificationService: NotificationService) {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_ANON_KEY || ''
        );
    }

    @Cron(CronExpression.EVERY_HOUR)
    async checkUpcomingEvents() {
        this.logger.log('Checking for upcoming high volume events...');

        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        // Format dates for Supabase query
        const nowISO = now.toISOString();
        const twoHoursISO = twoHoursFromNow.toISOString();

        // Find high volume events starting in the next 2 hours
        const { data: events, error } = await this.supabase
            .from('events')
            .select('id, name, location, date, "finishTime", "expectedVolume"')
            .in('expectedVolume', ['High', 'Very High'])
            .gte('date', nowISO)
            .lte('date', twoHoursISO)

        if (error) {
            this.logger.error('Failed to fetch upcoming events:', error.message);
            return;
        }

        if (!events || events.length === 0) {
            this.logger.log('No upcoming high volume events found');
            return;
        }

        this.logger.log(`Found ${events.length} high volume events`);

        // Get all push tokens
        const tokens = await this.notificationService.getAllPushTokens();

        // Send a notification for each event
        for (const event of events) {
            const title = '🚗 Surge Alert — PeakDrive';
            const body = `High demand expected near ${event.location} at ${event.finishTime}. Position yourself now!`;

            await this.notificationService.sendPushNotifications(tokens, title, body);
            this.logger.log(`Notification sent for event: ${event.name}`);
        }
    }
}