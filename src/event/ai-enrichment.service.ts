import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiEnrichmentService {
    private readonly logger = new Logger(AiEnrichmentService.name);
    private genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    }

    async findVenueAddress(
        title: string,
        city: string,
        date: string,
        description: string
    ): Promise<{ venue: string; address: string } | null> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-lite',
                tools: [{ googleSearch: {} }] as any
            });

            const prompt = `You are a research assistant for PeakDrive, a ride-hailing surge app in South Africa.

Search the web to find the exact venue name and physical street address for this event.

Event details:
- Title: ${title}
- City: ${city}
- Date: ${date}
- Description: ${description || 'None'}

Return ONLY a JSON object, no explanation, no markdown:
{
  "found": true,
  "venue": "Moses Mabhida Stadium",
  "address": "44 Isaiah Ntshangase Rd, Stamford Hill, Durban, 4001"
}

If you cannot find the specific venue and address after searching, return:
{
  "found": false,
  "venue": null,
  "address": null
}

Rules:
- venue is the name of the place (e.g. "Moses Mabhida Stadium", "Durban ICC")
- address is the physical street address (e.g. "44 Isaiah Ntshangase Rd, Stamford Hill, Durban, 4001")
- Never return "TBC", "Various Venues", "Online", or vague locations as venue
- If the event is online or has no physical location, return found: false`

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);

            if (!parsed.found || !parsed.venue) {
                this.logger.warn(`Could not find venue for "${title}"`);
                return null;
            }

            this.logger.log(`Found venue for "${title}": ${parsed.venue}`);
            return { venue: parsed.venue, address: parsed.address || '' };

        } catch (error) {
            this.logger.error(`Venue lookup failed for "${title}": ${(error as any).message}`);
            return null;
        }
    }

    async enrichEvent(
        title: string,
        venue: string,
        city: string,
        date: string,
        startTime: string,
        description: string
    ): Promise<{ finishTime: string; expectedVolume: string }> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-lite',
                tools: [{ googleSearch: {} }] as any
            });

            const prompt = `You are a research assistant for PeakDrive, a ride-hailing surge app in South Africa.

Research this event and find:
1. The official end time (search the event website, Quicket, Webtickets, venue page, or any news article)
2. The expected passenger volume for ride-hailing drivers

Event details:
- Title: ${title}
- Venue: ${venue}
- City: ${city}
- Date: ${date}
- Start time: ${startTime || 'Unknown'}
- Description: ${description || 'None'}

Return ONLY a JSON object in this exact format, no explanation, no markdown:
{
  "finishTime": "22:00:00",
  "expectedVolume": "high",
  "confidence": "found"
}

Rules:
- finishTime must be in HH:MM:SS 24-hour format
- confidence is "found" if you found real data, "estimated" if you guessed
- expectedVolume must be exactly one of: "low", "medium", "high", "very high"
- For expectedVolume: concerts/festivals/marathons = "very high", matches/shows/exhibitions = "high", conferences/ceremonies = "medium", small gatherings = "low"
- If no end time found anywhere, estimate based on event type`

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);

            const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
            const finishTime = timeRegex.test(parsed.finishTime)
                ? parsed.finishTime.length === 5
                    ? `${parsed.finishTime}:00`
                    : parsed.finishTime
                : (await this.estimateWithAI(title, venue, city, date, startTime, description)).finishTime;

            const validVolumes = ['low', 'medium', 'high', 'very high'];
            const expectedVolume = validVolumes.includes(parsed.expectedVolume)
                ? parsed.expectedVolume
                : (await this.estimateWithAI(title, venue, city, date, startTime, description)).expectedVolume;

            this.logger.log(`Enriched "${title}": ends ${finishTime}, volume ${expectedVolume} (${parsed.confidence})`);
            return { finishTime, expectedVolume };

        } catch (error) {
            this.logger.error(`AI enrichment failed for "${title}": ${(error as any).message}`);
            return this.estimateWithAI(title, venue, city, date, startTime, description);
        }
    }

    private async estimateWithAI(
        title: string,
        venue: string,
        city: string,
        date: string,
        startTime: string,
        description: string
    ): Promise<{ finishTime: string; expectedVolume: string }> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash-lite'
            });

            const prompt = `You are an expert on South African events and ride-hailing demand patterns.

Based on your knowledge, estimate:
1. What time this event likely ends
2. How many people will need rides after it

Event details:
- Title: ${title}
- Venue: ${venue}
- City: ${city}
- Date: ${date}
- Start time: ${startTime || 'Unknown'}
- Description: ${description || 'None'}

Return ONLY a JSON object, no explanation, no markdown:
{
  "finishTime": "22:00:00",
  "expectedVolume": "high",
  "confidence": "estimated"
}

Rules:
- finishTime must be in HH:MM:SS 24-hour format
- expectedVolume must be exactly one of: "low", "medium", "high", "very high"`

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);

            const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
            const finishTime = timeRegex.test(parsed.finishTime)
                ? parsed.finishTime.length === 5
                    ? `${parsed.finishTime}:00`
                    : parsed.finishTime
                : '22:00:00';

            const validVolumes = ['low', 'medium', 'high', 'very high'];
            const expectedVolume = validVolumes.includes(parsed.expectedVolume)
                ? parsed.expectedVolume
                : 'medium';

            this.logger.warn(`Used AI estimate for "${title}": ends ${finishTime}, volume ${expectedVolume}`);
            return { finishTime, expectedVolume };

        } catch (e) {
            this.logger.error(`AI estimate also failed for "${title}": ${(e as any).message}`);
            return { finishTime: '22:00:00', expectedVolume: 'medium' };
        }
    }
}