import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import * as xml2js from 'xml2js'

@Injectable()
export class EventSyncService {
    private readonly logger = new Logger(EventSyncService.name)

    constructor(private readonly httpService: HttpService) {}

    async fetchRSSFeed(url: string, cityId: string) {
        try {
            this.logger.log(`Connecting to internet feed for ${cityId}: ${url}`)

            const response = await firstValueFrom(this.httpService.get(url))
            const xmlData = response.data
            const parser = new xml2js.Parser({ explicitArray: false })
            const result = await parser.parseStringPromise(xmlData)
            const rawItems = result.rss.channel.item

            const mappedEvents = rawItems.map((item: any) => {
                return {
                    title: item.title,
                    description: item.description,
                    eventDate: item.pubDate ? new Date(item.pubDate) : new Date(),
                    link: item.link,
                    cityId: cityId
                };
            });

            this.logger.log(`Successfully parsed and mapped ${mappedEvents.length} clean events.`);
            return mappedEvents;
        }
        catch (error) {
            this.logger.error(`Failed to read internet feed: ${(error as any).message}`)
            return []
        }
    }
}