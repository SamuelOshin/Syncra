import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TranslationMemoryRepository } from './tm.repository';
import { successResponse } from '../../utils/response';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { buildPaginationMeta, parsePagination } from '../../utils/pagination';

const tmRepository = new TranslationMemoryRepository();

export class TranslationMemoryController {
  async getSegments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;
      const pagination = parsePagination(req.query);
      const { items: segments, total } = await tmRepository.findByUserIdPaginated(userId, pagination);

      successResponse(res, 200, 'Translation memory segments retrieved successfully', {
        segments,
        pagination: buildPaginationMeta(pagination, total),
      });
    } catch (error) {
      next(error);
    }
  }

  async createSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceText, targetText, sourceLang, targetLang, projectId } = req.body;
      const userId = req.session.user!.id;
      const id = randomUUID();
      const normalizedSource = sourceText.trim().toLowerCase();

      const newSegment = await tmRepository.create({
        id,
        userId,
        sourceText: normalizedSource,
        targetText: targetText.trim(),
        sourceLang,
        targetLang,
        projectId: projectId || null,
      });

      successResponse(res, 201, 'Translation memory segment created successfully', {
        segment: newSegment
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.session.user!.id;

      const segment = await tmRepository.findById(id);
      if (!segment) {
        next(new NotFoundError('Translation memory segment not found', 'TM_SEGMENT_NOT_FOUND'));
        return;
      }

      if (segment.userId !== userId) {
        next(new ForbiddenError('You do not have permission to delete this translation segment', 'FORBIDDEN_TM_ACCESS'));
        return;
      }

      await tmRepository.delete(id);
      successResponse(res, 200, 'Translation memory segment deleted successfully', {});
    } catch (error) {
      next(error);
    }
  }
}
export default TranslationMemoryController;
