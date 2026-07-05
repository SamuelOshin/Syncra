import { Request, Response, NextFunction } from 'express';
import { NotificationRepository } from './notification.repository';
import { PushSubscriptionRepository } from './push-subscription.repository';
import { successResponse } from '../../utils/response';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';
import { webPushService } from '../../services/web-push.service';
import { config } from '../../config';
import { randomUUID } from 'crypto';
import { BadRequestError } from '../../utils/errors';

const notificationRepository = new NotificationRepository();
const pushSubRepository = new PushSubscriptionRepository();

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const pagination = parsePagination(req.query);
      const { items: notifications, total } = await notificationRepository.findByUserIdPaginated(userId, pagination);

      successResponse(res, 200, 'Notifications retrieved successfully', {
        notifications,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await notificationRepository.markAllAsRead(userId);

      successResponse(res, 200, 'All notifications marked as read', {});
    } catch (error) {
      next(error);
    }
  }

  async clearNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await notificationRepository.clearAll(userId);

      successResponse(res, 200, 'All notifications cleared successfully', {});
    } catch (error) {
      next(error);
    }
  }

  async getVapidKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicKey = config.vapidPublicKey;
      successResponse(res, 200, 'VAPID public key retrieved successfully', { publicKey });
    } catch (error) {
      next(error);
    }
  }

  async subscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        next(new BadRequestError('Invalid push subscription payload', 'INVALID_PUSH_SUBSCRIPTION'));
        return;
      }

      await pushSubRepository.create({
        id: randomUUID(),
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      });

      successResponse(res, 201, 'Push subscription registered successfully', {});
    } catch (error) {
      next(error);
    }
  }

  async unsubscribePush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { endpoint } = req.body;

      if (!endpoint) {
        next(new BadRequestError('Endpoint is required to unsubscribe', 'ENDPOINT_REQUIRED'));
        return;
      }

      await pushSubRepository.deleteByUserAndEndpoint(userId, endpoint);

      successResponse(res, 200, 'Push subscription removed successfully', {});
    } catch (error) {
      next(error);
    }
  }

  async testPush(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      await webPushService.sendPushNotification(
        userId,
        'Syncra Test Notification 🔔',
        'If you are reading this, Web Push notifications are working perfectly on your device!',
        'success',
        '/'
      );

      successResponse(res, 200, 'Test push notification dispatched', {});
    } catch (error) {
      next(error);
    }
  }
}
export default NotificationController;

