export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly errorCode: string = 'INTERNAL_ERROR',
    public readonly errors: Record<string, string[]> | any[] = {}
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND') {
    super(404, message, errorCode);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', errorCode: string = 'BAD_REQUEST', errors: Record<string, string[]> | any[] = {}) {
    super(400, message, errorCode, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', errorCode: string = 'UNAUTHORIZED') {
    super(401, message, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', errorCode: string = 'FORBIDDEN') {
    super(403, message, errorCode);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', errorCode: string = 'CONFLICT') {
    super(409, message, errorCode);
  }
}
