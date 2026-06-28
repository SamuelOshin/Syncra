import { Router } from 'express';
import { ProjectController } from './project.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createProjectSchema } from './project.schema';

const router = Router();
const projectController = new ProjectController();

// Protect all project endpoints
router.use(requireAuth);

router.get('/', (req, res, next) => projectController.getProjects(req, res, next));
router.post('/', validate(createProjectSchema), (req, res, next) => projectController.createProject(req, res, next));
router.delete('/:id', (req, res, next) => projectController.deleteProject(req, res, next));

export default router;
