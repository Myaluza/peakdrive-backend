import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { NotificationService } from './notifications/notification.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-notifications')
  async testNotifications() {
    const tokens = await this.notificationService.getAllPushTokens();
    await this.notificationService.sendPushNotifications(
      tokens,
      '🚗 Surge Alert — PeakDrive',
      'High demand expected near Moses Mabhida at 19:00. Position yourself now!'
    );
    return { message: `Notification sent to ${tokens.length} devices` };
  }
}