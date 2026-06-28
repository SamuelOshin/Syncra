import { Request, Response, NextFunction } from 'express';
import { NotificationRepository } from './notification.repository';
import { successResponse } from '../../utils/response';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';

const notificationRepository = new NotificationRepository();

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;
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
      const userId = req.session.user!.id;
      await notificationRepository.markAllAsRead(userId);

      successResponse(res, 200, 'All notifications marked as read', {});
    } catch (error) {
      next(error);
    }
  }

  async clearNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;
      await notificationRepository.clearAll(userId);

      successResponse(res, 200, 'All notifications cleared successfully', {});
    } catch (error) {
      next(error);
    }
  }
}
export default NotificationController;
