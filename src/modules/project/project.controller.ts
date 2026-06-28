import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ProjectRepository } from './project.repository';
import { NotificationRepository } from '../notifications/notification.repository';
import { successResponse } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';

const projectRepository = new ProjectRepository();
const notificationRepository = new NotificationRepository();

export class ProjectController {
  async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;
      const pagination = parsePagination(req.query);
      const { items: projects, total } = await projectRepository.findByUserIdPaginated(userId, pagination);

      successResponse(res, 200, 'Projects retrieved successfully', {
        projects,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description } = req.body;
      const userId = req.session.user!.id;
      const id = randomUUID();

      const newProject = await projectRepository.create({
        id,
        userId,
        name,
        description: description || ''
      });

      await notificationRepository.create({
        id: randomUUID(),
        userId,
        title: 'Project Created',
        message: `Project "${name}" has been created successfully.`,
        type: 'success'
      }).catch(err => console.error('Failed to create notification:', err));

      successResponse(res, 201, 'Project created successfully', {
        project: newProject
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;

      const project = await projectRepository.findById(id);
      if (!project) {
        next(new NotFoundError('Project not found', 'PROJECT_NOT_FOUND'));
        return;
      }

      if (project.userId !== userId) {
        next(new ForbiddenError('You do not have permission to delete this project', 'FORBIDDEN_PROJECT_ACCESS'));
        return;
      }

      await projectRepository.delete(id);

      await notificationRepository.create({
        id: randomUUID(),
        userId,
        title: 'Project Deleted',
        message: `Project "${project.name}" has been deleted.`,
        type: 'warning'
      }).catch(err => console.error('Failed to create notification:', err));

      successResponse(res, 200, 'Project deleted successfully', {});
    } catch (error) {
      next(error);
    }
  }
}
export default ProjectController;
