import { NotificationRepository, NotificationRecord } from './notification.repository';
import { webPushService } from '../../services/web-push.service';

const notificationRepository = new NotificationRepository();

export class NotificationService {
  async createNotification(record: NotificationRecord): Promise<NotificationRecord> {
    // 1. Create DB notification
    const newNotification = await notificationRepository.create(record);

    // 2. Dispatch Web Push notification
    webPushService.sendPushNotification(
      record.userId,
      record.title,
      record.message,
      record.type || 'info',
      '/'
    ).catch(err => {
      console.error('[NotificationService] Failed to dispatch push notification:', err);
    });

    return newNotification;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
