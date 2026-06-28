import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../utils/response';
import { BadRequestError } from '../../utils/errors';
import { SearchRepository } from './search.repository';

const searchRepository = new SearchRepository();

export class SearchController {
  async globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      const userId = req.session.user!.id;

      if (!q || typeof q !== 'string' || !q.trim()) {
        next(new BadRequestError('Search query is required', 'SEARCH_QUERY_REQUIRED'));
        return;
      }

      const results = await searchRepository.globalSearch(userId, q);

      successResponse(res, 200, 'Search results retrieved successfully', {
        results
      });
    } catch (error) {
      next(error);
    }
  }
}
export default SearchController;
