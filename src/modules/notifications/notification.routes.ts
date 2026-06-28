import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// Protect all notification endpoints
router.use(requireAuth);

router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));
router.post('/read', (req, res, next) => notificationController.markAsRead(req, res, next));
router.delete('/', (req, res, next) => notificationController.clearNotifications(req, res, next));

export default router;
