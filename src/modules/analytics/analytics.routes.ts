import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
const analyticsController = new AnalyticsController();

// Protect all analytics endpoints
router.use(requireAuth);

router.get('/stats', (req, res, next) => analyticsController.getOverviewStats(req, res, next));

export default router;
