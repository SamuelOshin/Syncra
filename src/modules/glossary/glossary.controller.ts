import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { GlossaryRepository } from './glossary.repository';
import { successResponse } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { NotificationRepository } from '../notifications/notification.repository';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';

const glossaryRepository = new GlossaryRepository();

export class GlossaryController {
  async getTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;
      const pagination = parsePagination(req.query);
      const { items: terms, total } = await glossaryRepository.findByUserIdPaginated(userId, pagination);

      successResponse(res, 200, 'Glossary terms retrieved successfully', {
        terms,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async createTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceText, targetText, sourceLang, targetLang, projectId } = req.body;
      const userId = req.session.user!.id;
      const id = randomUUID();

      const newTerm = await glossaryRepository.create({
        id,
        userId,
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        projectId: projectId || null,
      });

      const notificationRepository = new NotificationRepository();
      await notificationRepository.create({
        id: randomUUID(),
        userId,
        title: 'Glossary Term Added',
        message: `Added "${sourceText}" -> "${targetText}" to your glossary.`,
        type: 'info'
      }).catch(err => console.error('Failed to create notification:', err));

      successResponse(res, 201, 'Glossary term created successfully', {
        term: newTerm
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTerm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;

      const term = await glossaryRepository.findById(id);
      if (!term) {
        next(new NotFoundError('Glossary term not found', 'GLOSSARY_TERM_NOT_FOUND'));
        return;
      }

      if (term.userId !== userId) {
        next(new ForbiddenError('You do not have permission to delete this glossary term', 'FORBIDDEN_GLOSSARY_ACCESS'));
        return;
      }

      await glossaryRepository.delete(id);
      successResponse(res, 200, 'Glossary term deleted successfully', {});
    } catch (error) {
      next(error);
    }
  }
}
export default GlossaryController;
