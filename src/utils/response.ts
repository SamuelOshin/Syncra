import { Response } from 'express';

export interface SuccessEnvelope<T = any> {
  status: 'success';
  status_code: number;
  message: string;
  data: T;
  meta?: any;
}

export interface ErrorEnvelope {
  status: 'failure';
  status_code: number;
  message: string;
  error_code: string;
  errors: Record<string, string[]> | any[];
}

/**
 * Sends a standardized success response.
 * @param res Express Response object
 * @param statusCode HTTP Status Code
 * @param message User-friendly message
 * @param data Response payload (always an object)
 * @param meta Optional pagination or metadata
 */
export function successResponse<T = any>(
  res: Response,
  statusCode: number,
  message: string,
  data: T = {} as T,
  meta?: any
): void {
  const responseBody: SuccessEnvelope<T> = {
    status: 'success',
    status_code: statusCode,
    message,
    data,
  };

  if (meta) {
    responseBody.meta = meta;
  }

  res.status(statusCode).json(responseBody);
}

/**
 * Sends a standardized, framework-agnostic error response.
 * @param res Express Response object
 * @param statusCode HTTP Status Code
 * @param message User-friendly error message
 * @param errorCode UPPERCASE_SNAKE_CASE error code
 * @param errors Field-specific validation errors or details
 */
export function errorResponse(
  res: Response,
  statusCode: number,
  message: string,
  errorCode: string = 'INTERNAL_ERROR',
  errors: Record<string, string[]> | any[] = {}
): void {
  const responseBody: ErrorEnvelope = {
    status: 'failure',
    status_code: statusCode,
    message,
    error_code: errorCode,
    errors,
  };

  res.status(statusCode).json(responseBody);
}
