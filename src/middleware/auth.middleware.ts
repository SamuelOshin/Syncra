import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    next(new UnauthorizedError('You must be logged in to perform this action', 'UNAUTHORIZED'));
    return;
  }
  next();
}
export default requireAuth;
