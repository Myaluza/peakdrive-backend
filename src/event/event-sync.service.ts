import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AiEnrichmentService } from "./ai-enrichment.service";
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const LOG_DIR = path.join(process.cwd(), 'logs');
const REVIEW_LOG = path.join(LOG_DIR, 'events-requiring-review.log');

// Placeholder values that should be rejected
const INVALID_LOCATIONS = [
    'tbc', 'tbd', 'various venues', 'various locations', 'online',
    'virtual', 'to be confirmed', 'to be announced', 'nationwide'
]

function isValidLocation(address: string | string[] | undefined): boolean {
    if (!address) return false;
    const str = Array.isArray(address) ? address.join(', ') : address;
    if (str.trim() === '') return false;
    const lower = str.toLowerCase().trim();
    if (INVALID_LOCATIONS.some(invalid => lower.includes(invalid))) return false;
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    return parts.length >= 2;
}

function formatAddress(address: string | string[] | undefined): string {
    if (!address) return '';
    return Array.isArray(address) ? address.join(', ') : address.trim();
}

function parseStartTime(whenStr: string): string {
    if (!whenStr) return 'Unknown';
    const timeMatch = whenStr.match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
    if (!timeMatch) return 'Unknown';
    return timeMatch[1];
}

function parseEndTime(whenStr: string): string | null {
    if (!whenStr) return null;
    const rangeMatch = whenStr.match(/–\s*(\d{1,2}:\d{2}\s?[AP]M)/i);
    if (!rangeMatch) return null;
    const timeStr = rangeMatch[1].trim();
    const [time, period] = timeStr.split(/\s+/);
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period?.toUpperCase() === 'PM' && hours !== 12) hour24 += 12;
    if (period?.toUpperCase() === 'AM' && hours === 12) hour24 = 0;
    return `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function parseEventDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // SerpAPI sometimes returns relative strings like "Tomorrow" or "Jun 25"
    // Always append current year if no year is present
    const currentYear = new Date().getFullYear();
    const hasYear = /\d{4}/.test(dateStr);
    const withYear = hasYear ? dateStr : `${dateStr} ${currentYear}`;

    try {
        const parsed = new Date(withYear);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    } catch {}

    return new Date().toISOString().split('T')[0];
}

function generateEventKey(title: string, date: string): string {
    // Create a consistent unique key from title + date
    // Normalise title to catch minor variations like extra spaces or punctuation
    const normalised = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    const hash = crypto.createHash('md5').update(`${normalised}_${date}`).digest('hex');
    return `peakdrive_${hash}`;
}

function writeReviewLog(event: any, reason: string) {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const entry = `
[${timestamp}]
Reason: ${reason}
Title: ${event.title}
Date: ${event.date?.when || event.date?.start_date || 'Unknown'}
Address: ${JSON.stringify(event.address)}
Link: ${event.link || 'None'}
Description: ${event.description || 'None'}
${'─'.repeat(60)}
`;
    fs.appendFileSync(REVIEW_LOG, entry, 'utf8');
}

@Injectable()
export class EventSyncService {
    private readonly logger = new Logger(EventSyncService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly aiEnrichmentService: AiEnrichmentService
    ) {}

    async fetchEventsForCity(cityId: string, cityName: string) {
        try {
            const apiKey = process.env.SERPAPI_KEY;
            if (!apiKey) {
                this.logger.error("SERPAPI_KEY is missing from your .env file!");
                return [];
            }

            this.logger.log(`Fetching events for ${cityName} from SerpAPI...`);

            const response = await firstValueFrom(
                this.httpService.get('https://serpapi.com/search.json', {
                    params: {
                        engine: 'google_events',
                        q: `events in ${cityName}`,
                        hl: 'en',
                        gl: 'za',
                        api_key: apiKey
                    }
                })
            );

            const rawEvents = response.data?.events_results || [];

            if (rawEvents.length === 0) {
                this.logger.warn(`No events returned for ${cityName}`);
                return [];
            }

            const enrichedEvents: any[] = [];
            const seenKeys = new Set<string>();

            for (const event of rawEvents) {
                const whenStr = event.date?.when || '';
                const dateStr = parseEventDate(event.date?.start_date || whenStr);
                const startTime = parseStartTime(whenStr);
                const serpEndTime = parseEndTime(whenStr);
                const description = event.description || '';

                // Step 1: deduplicate using title + date hash
                const eventKey = generateEventKey(event.title, dateStr);
                if (seenKeys.has(eventKey)) {
                    this.logger.warn(`Duplicate skipped: "${event.title}" on ${dateStr}`);
                    continue;
                }
                seenKeys.add(eventKey);

                // Step 2: validate location
                let venue: string;
                let address: string;

                if (isValidLocation(event.address)) {
                    const raw = formatAddress(event.address);
                    // Split into venue (first part) and address (rest)
                    const parts = raw.split(',').map((p: string) => p.trim());
                    venue = parts[0];
                    address = parts.slice(1).join(', ');
                } else {
                    this.logger.warn(`No valid location for "${event.title}" — asking AI...`);
                    const found = await this.aiEnrichmentService.findVenueAddress(
                        event.title, cityName, dateStr, description
                    );

                    if (!found) {
                        this.logger.warn(`Skipping "${event.title}" — no venue found. Logged for review.`);
                        writeReviewLog(event, 'Could not determine venue or address after AI lookup');
                        continue;
                    }

                    venue = found.venue;
                    address = found.address;
                }

                // Step 3: enrich with AI
                let finishTime: string;
                let expectedVolume: string;

                if (serpEndTime) {
                    finishTime = serpEndTime;
                    const enriched = await this.aiEnrichmentService.enrichEvent(
                        event.title, venue, cityName, dateStr, startTime, description
                    );
                    expectedVolume = enriched.expectedVolume;
                } else {
                    const enriched = await this.aiEnrichmentService.enrichEvent(
                        event.title, venue, cityName, dateStr, startTime, description
                    );
                    finishTime = enriched.finishTime;
                    expectedVolume = enriched.expectedVolume;
                }

                enrichedEvents.push({
                    title: event.title,
                    description,
                    eventDate: new Date(dateStr),
                    link: event.link || '',
                    cityId,
                    venue,
                    address,
                    finishTime,
                    expectedVolume,
                    eventKey
                });
            }

            this.logger.log(`Processed ${enrichedEvents.length} valid events for ${cityName} (${rawEvents.length - enrichedEvents.length} skipped)`);
            return enrichedEvents;

        } catch (error) {
            this.logger.error(`SerpAPI fetch failed for ${cityName}: ${(error as any).message}`);
            return [];
        }
    }
}