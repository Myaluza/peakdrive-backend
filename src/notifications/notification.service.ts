import { Injectable, Logger } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import * as serviceAccount from '../../firebase-service-account.json';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name)
    private supabase

    constructor() {
    this.supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Initialise Firebase Admin SDK if not already initialised
    if (!getApps().length) {
        initializeApp({
            credential: cert(serviceAccount as any)
        })
    }
}

    async getAllPushTokens(): Promise<string[]> {
        const { data, error } = await this.supabase
            .from('push_tokens')
            .select('token')

        if (error) {
            this.logger.error('Failed to fetch push tokens:', error.message)
            return []
        }

        return data.map((row: { token: string }) => row.token)
    }

    async sendPushNotifications(tokens: string[], title: string, body: string) {
        if (tokens.length === 0) {
            this.logger.log('No push tokens found, skipping notifications')
            return
        }

        // Expo push tokens need to be sent via Expo's API
        // FCM tokens need to be sent via Firebase Admin SDK
        // We'll handle both cases
        const expoTokens = tokens.filter(t => t.startsWith('ExponentPushToken'))
        const fcmTokens = tokens.filter(t => !t.startsWith('ExponentPushToken'))

        // Send to Expo tokens via Expo Push API
        if (expoTokens.length > 0) {
            await this.sendViaExpoPush(expoTokens, title, body)
        }

        // Send to FCM tokens directly via Firebase Admin
        if (fcmTokens.length > 0) {
            await this.sendViaFirebaseAdmin(fcmTokens, title, body)
        }
    }

    private async sendViaExpoPush(tokens: string[], title: string, body: string) {
        const axios = (await import('axios')).default
        const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: { screen: 'home' }
        }))

        try {
            const response = await axios.post(
                'https://exp.host/--/api/v2/push/send',
                messages,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip, deflate'
                    }
                }
            )
            this.logger.log(`Expo push sent to ${tokens.length} devices`)

            // Check for errors in response
            const results = response.data?.data || []
            results.forEach((result: any, i: number) => {
                if (result.status === 'error') {
                    this.logger.error(`Expo push error for token ${tokens[i]}: ${result.message}`)
                }
            })
        } catch (error) {
            this.logger.error('Expo push failed:', (error as any).message)
        }
    }

    private async sendViaFirebaseAdmin(tokens: string[], title: string, body: string) {
        try {
            const message: MulticastMessage = {
                tokens,
                notification: { title, body },
                android: {
                    priority: 'high',
                    notification: { sound: 'default' }
                }
            }
            const response = await getMessaging().sendEachForMulticast(message)
            this.logger.log(`Firebase Admin sent ${response.successCount} notifications`)
            if (response.failureCount > 0) {
                this.logger.error(`Firebase Admin failed for ${response.failureCount} tokens`)
            }
        } catch (error) {
            this.logger.error('Firebase Admin push failed:', (error as any).message)
        }
    }
}