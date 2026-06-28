import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { BadRequestError } from '../utils/errors';

export const validate = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};
        
        error.issues.forEach((issue) => {
          // Remove the top-level request boundary keys (body, query, params) from the error path
          const path = issue.path
            .join('.')
            .replace(/^body\./, '')
            .replace(/^query\./, '')
            .replace(/^params\./, '');
            
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(issue.message);
        });

        // Pass the typed validation error to the global error handler
        next(new BadRequestError('Validation failed', 'VALIDATION_ERROR', formattedErrors));
        return;
      }
      next(error);
    }
  };
};
export default validate;
