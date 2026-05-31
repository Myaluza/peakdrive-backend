import { createClient } from '@supabase/supabase-js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventService {
    private supabase
    
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_ANON_KEY || '')
    }
    
    async getEventsByCity(cityId: string) {
        const formattedCity = cityId.trim().toLowerCase()
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await this.supabase
            .from('events')
            .select('name, location, date, "finishTime", "expectedVolume", latitude, longitude')
            .eq('city_id', formattedCity)
            .gte('date', today)

        if (error) {
            console.error('Supabase Query Error:', error.message)
            return []
        }

        return data;
    }

    async saveExternalEvents(events: any[]) {
        const recordsToInsert = events.map(event => ({
            name: event.title,
            location: 'External Feed Source',
            address: event.link || 'No Address',
            date: event.eventDate.toISOString().split('T')[0],
            finishTime: '23:59:59',
            expectedVolume: 'Unknown',
            city_id: event.cityId,
            latitude: 0.0,
            longitude: 0.0,
            source_url: event.link
        }));

        const { data, error } = await this.supabase
        .from('events')
        .upsert(recordsToInsert, { 
            onConflict: 'source_url',
            ignoreDuplicates: true 
        })
        .select();

        if (error) {
        throw new Error(`Supabase sync failed: ${error.message}`);
        }

    return data;
  }
}
