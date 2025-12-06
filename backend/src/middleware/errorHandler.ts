/**
 * Centralized Error Handler Middleware
 *
 * Catches all errors and returns standardized responses.
 * Also handles async errors when wrapped with asyncHandler.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';
import {
  AppError,
  ErrorCode,
  ErrorResponse,
  isAppError,
  createErrorResponse,
  ValidationError,
} from '../utils/errors';

// Generate a simple request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add request ID to all requests
 */
export const addRequestId: RequestHandler = (req, _res, next) => {
  req.requestId = generateRequestId();
  next();
};

/**
 * Convert Zod validation errors to our ValidationError format
 */
function handleZodError(error: ZodError): AppError {
  const details: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  });

  return new ValidationError('Validation failed', { fields: details });
}

/**
 * Main error handler middleware
 * Must be registered after all routes
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = handleZodError(err);
    const response = createErrorResponse(validationError, requestId);

    logger.warn('Validation error', {
      requestId,
      path: req.path,
      method: req.method,
      errors: response.error.details,
    });

    res.status(validationError.statusCode).json(response);
    return;
  }

  // Handle our custom AppError instances
  if (isAppError(err)) {
    const response = createErrorResponse(err, requestId);

    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      logger.error('Server error', {
        requestId,
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
    } else if (err.statusCode >= 400) {
      logger.warn('Client error', {
        requestId,
        path: req.path,
        method: req.method,
        code: err.code,
        message: err.message,
      });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unexpected errors (non-operational)
  logger.error('Unexpected error', {
    requestId,
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  });

  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  res.status(500).json(response);
}

/**
 * Wrapper for async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Must be registered after all routes but before error handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
  };

  res.status(404).json(response);
}
