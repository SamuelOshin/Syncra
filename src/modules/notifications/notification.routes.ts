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

// Web Push endpoints
router.get('/push/vapid-key', (req, res, next) => notificationController.getVapidKey(req, res, next));
router.post('/push/subscribe', (req, res, next) => notificationController.subscribePush(req, res, next));
router.post('/push/unsubscribe', (req, res, next) => notificationController.unsubscribePush(req, res, next));
router.post('/push/test', (req, res, next) => notificationController.testPush(req, res, next));

export default router;
