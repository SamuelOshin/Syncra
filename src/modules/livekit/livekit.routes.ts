import { Router } from 'express';
import { LiveKitController } from './livekit.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();
const livekitController = new LiveKitController();

// Protect all LiveKit endpoints
router.use(requireAuth);

router.get('/token', (req, res, next) => livekitController.getToken(req, res, next));

export default router;
