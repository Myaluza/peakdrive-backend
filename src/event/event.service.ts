import { createClient } from '@supabase/supabase-js';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EventService {
    private readonly logger = new Logger(EventService.name);
    private supabase

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        )
    }

    async getEventsByCity(cityId: string) {
        const formattedCity = cityId.trim().toLowerCase()
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await this.supabase
            .from('events')
            .select('id, name, location, date, "finishTime", "expectedVolume", latitude, longitude')
            .eq('city_id', formattedCity)
            .gte('date', today)

        if (error) {
            this.logger.error('Supabase Query Error:', error.message)
            return []
        }

        return data;
    }

    async saveExternalEvents(events: any[]) {
        const recordsToInsert = events.map(event => {
            let dateStr: string;
            try {
                const d = new Date(event.eventDate)
                dateStr = isNaN(d.getTime())
                    ? new Date().toISOString().split('T')[0]
                    : d.toISOString().split('T')[0]
            } catch {
                dateStr = new Date().toISOString().split('T')[0]
            }

            return {
                name: event.title,
                location: event.venue || 'Unknown Venue',
                address: event.address || '',
                date: dateStr,
                finishTime: event.finishTime || '22:00:00',
                expectedVolume: event.expectedVolume || 'medium',
                city_id: event.cityId,
                latitude: 0.0,
                longitude: 0.0,
                source_url: event.eventKey || event.link || event.title
            }
        });

        const { data, error } = await this.supabase
            .from('events')
            .upsert(recordsToInsert, {
                onConflict: 'source_url',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            throw new Error(`Supabase sync failed: ${error.message}`);
        }

        this.logger.log(`Saved/updated ${data?.length || 0} events`);
        return data;
    }

    async deleteOldEvents() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const { error } = await this.supabase
            .from('events')
            .delete()
            .lt('date', cutoffStr);

        if (error) {
            this.logger.error('Failed to delete old events:', error.message);
            return;
        }

        this.logger.log(`Deleted events older than ${cutoffStr}`);
    }
}