import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class EventSyncService {
    private readonly logger = new Logger(EventSyncService.name);

    constructor(private readonly httpService: HttpService) {}

    async fetchRSSFeed(url: string, cityId: string) {
        try {
            const apiKey = process.env.QUICKET_API_KEY;
            if (!apiKey) {
                this.logger.error("QUICKET_API_KEY is missing from your .env file!");
                return [];
            }

            this.logger.log(`Connecting to Quicket Production API for ${cityId}...`);

            // Fire the request using Quicket's explicit gateway header and query patterns
            const response = await firstValueFrom(
                this.httpService.get('https://api.quicket.co.za/api/events', {
                    headers: {
                        'Accept': 'application/json',
                        // 1. Quicket API management gateway standard header layer
                        'Ocp-Apim-Subscription-Key': apiKey 
                    },
                    params: {
                        // 2. Fallback query matching the collection value identifier
                        apiKey: ''
, 
                        pageSize: 50,
                        page: 1
                    }
                })
            );

            // Unpack from their structural results array format
            const rawEvents = response.data?.results || (Array.isArray(response.data) ? response.data : []);

            if (!rawEvents || rawEvents.length === 0) {
                this.logger.warn("Quicket returned an empty dataset or structure mismatch.");
                return [];
            }

            // Map production fields over to your core datastore keys
            const mappedEvents = rawEvents.map((event: any) => {
                return {
                    title: event.name, 
                    description: event.description || 'No Description',
                    eventDate: event.start_date ? new Date(event.start_date) : new Date(), 
                    link: event.url, 
                    cityId: cityId
                };
            });

            this.logger.log(`Successfully pulled and mapped ${mappedEvents.length} real events from Quicket.`);
            return mappedEvents;

        } catch (error) {
            this.logger.error(`Failed to read Quicket API feed: ${(error as any).message}`);
            return [];
        }
    }
}