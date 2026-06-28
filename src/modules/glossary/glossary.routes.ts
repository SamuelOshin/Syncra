import { Router } from 'express';
import { GlossaryController } from './glossary.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createGlossarySchema } from './glossary.schema';

const router = Router();
const glossaryController = new GlossaryController();

// Protect all glossary endpoints
router.use(requireAuth);

router.get('/', (req, res, next) => glossaryController.getTerms(req, res, next));
router.post('/', validate(createGlossarySchema), (req, res, next) => glossaryController.createTerm(req, res, next));
router.delete('/:id', (req, res, next) => glossaryController.deleteTerm(req, res, next));

export default router;
