import { Router } from 'express';
import { SearchController } from './search.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { searchLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();
const searchController = new SearchController();

router.use(requireAuth);

router.get('/', searchLimiter, (req, res, next) => searchController.globalSearch(req, res, next));

export default router;
