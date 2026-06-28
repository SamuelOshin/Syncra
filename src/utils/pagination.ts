import { BadRequestError } from './errors';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new BadRequestError(`${name} must be a positive integer`, 'INVALID_PAGINATION');
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError(`${name} must be a positive integer`, 'INVALID_PAGINATION');
  }

  return parsed;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = parsePositiveInteger(query.page, 'page') ?? DEFAULT_PAGE;
  const requestedLimit = parsePositiveInteger(query.limit, 'limit') ?? DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function buildPaginationMeta(params: PaginationParams, total: number): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
}

