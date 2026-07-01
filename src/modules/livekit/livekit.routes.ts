import { Router } from 'express';
import { LiveKitController } from './livekit.controller';
import { optionalAuth } from '../../middleware/auth.middleware';

const router = Router();
const livekitController = new LiveKitController();

router.get('/token', optionalAuth, (req, res, next) => livekitController.getToken(req, res, next));

export default router;
