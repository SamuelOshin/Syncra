import { Router } from 'express';
import { TranslationMemoryController } from './tm.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createTMSchema } from './tm.schema';

const router = Router();
const tmController = new TranslationMemoryController();

// Protect all translation memory endpoints
router.use(requireAuth);

router.get('/', (req, res, next) => tmController.getSegments(req, res, next));
router.post('/', validate(createTMSchema), (req, res, next) => tmController.createSegment(req, res, next));
router.delete('/:id', (req, res, next) => tmController.deleteSegment(req, res, next));

export default router;
