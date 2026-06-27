import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeocodingService {
    private readonly logger = new Logger(GeocodingService.name);

    constructor(private readonly httpService: HttpService) {}

    async geocodeAddress(venue: string, address: string, city: string): Promise<{ latitude: number; longitude: number } | null> {
        try {
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                this.logger.error('GOOGLE_MAPS_API_KEY is missing');
                return null;
            }

            // Build search query — try full address first, fall back to venue + city
            const query = address
                ? `${venue}, ${address}`
                : `${venue}, ${city}, South Africa`;

            const response = await firstValueFrom(
                this.httpService.get('https://maps.googleapis.com/maps/api/geocode/json', {
                    params: {
                        address: query,
                        key: apiKey,
                        region: 'za'
                    }
                })
            );

            const results = response.data?.results;

            if (!results || results.length === 0) {
                this.logger.warn(`No geocoding results for "${query}"`);
                return null;
            }

            const location = results[0].geometry.location;
            this.logger.log(`Geocoded "${venue}": ${location.lat}, ${location.lng}`);

            return {
                latitude: location.lat,
                longitude: location.lng
            };

        } catch (error) {
            this.logger.error(`Geocoding failed for "${venue}": ${(error as any).message}`);
            return null;
        }
    }
}