/**
 * Standardized API Error Responses
 * P3-009: Consistent error format across all endpoints
 */

import type { Response } from 'express';

/**
 * Standard error codes for API responses
 */
export const ErrorCode = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // State
  INVALID_STATE: 'INVALID_STATE',
  CONFLICT: 'CONFLICT',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Send a standardized API error response
 */
export function apiError(
  res: Response,
  status: number,
  code: ErrorCodeType,
  message: string,
  details?: unknown
): Response {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details !== undefined && { details })
    }
  });
}

// Convenience methods for common errors

export function unauthorized(res: Response, message: string = 'Not authenticated'): Response {
  return apiError(res, 401, ErrorCode.UNAUTHORIZED, message);
}

export function forbidden(res: Response, message: string = 'Not authorized'): Response {
  return apiError(res, 403, ErrorCode.FORBIDDEN, message);
}

export function notFound(res: Response, resource: string = 'Resource'): Response {
  return apiError(res, 404, ErrorCode.NOT_FOUND, `${resource} not found`);
}

export function validationError(res: Response, message: string, details?: unknown): Response {
  return apiError(res, 400, ErrorCode.VALIDATION_ERROR, message, details);
}

export function internalError(res: Response, message: string = 'An unexpected error occurred'): Response {
  return apiError(res, 500, ErrorCode.INTERNAL_ERROR, message);
}

export function serviceUnavailable(res: Response, message: string): Response {
  return apiError(res, 503, ErrorCode.SERVICE_UNAVAILABLE, message);
}
