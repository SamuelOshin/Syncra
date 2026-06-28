import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import Logger from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  // If the error is an instance of our AppError, handle it as an operational domain error
  if (err instanceof AppError) {
    Logger.warn('operational_error', {
      status_code: err.statusCode,
      error_code: err.errorCode,
      message: err.message,
      path: req.originalUrl,
    });
    
    errorResponse(res, err.statusCode, err.message, err.errorCode, err.errors);
    return;
  }

  // Otherwise, it is an unexpected programmer/system error
  Logger.error('unhandled_exception', err, {
    path: req.originalUrl,
    method: req.method,
  });

  // Return a clean, framework-agnostic error response. Never leak raw errors or stack traces in production!
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred' 
    : err.message;

  errorResponse(res, 500, message, 'INTERNAL_ERROR');
}
export default errorHandler;
