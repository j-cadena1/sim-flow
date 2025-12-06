/**
 * Standardized Error Classes and Utilities
 *
 * Provides consistent error handling across the API with:
 * - Custom error classes for different error types
 * - Standardized error response format
 * - Error codes for client-side handling
 */

// Error codes for client-side handling and logging
export enum ErrorCode {
  // Authentication errors (1xxx)
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',

  // Authorization errors (2xxx)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors (3xxx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors (4xxx)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',

  // Business logic errors (5xxx)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_HOURS = 'INSUFFICIENT_HOURS',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',

  // External service errors (6xxx)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  GRAPH_API_ERROR = 'GRAPH_API_ERROR',

  // Server errors (9xxx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

// Standardized error response format
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

// Base application error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Authentication errors (401)
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AUTH_REQUIRED,
    details?: Record<string, unknown>
  ) {
    super(code, message, 401, details);
  }
}

// Authorization errors (403)
export class AuthorizationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.FORBIDDEN,
    details?: Record<string, unknown>
  ) {
    super(code, message, 403, details);
  }
}

// Validation errors (400)
export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

// Not found errors (404)
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier?: string | number
  ) {
    const message = identifier
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
    super(ErrorCode.RESOURCE_NOT_FOUND, message, 404, { resource, identifier });
  }
}

// Conflict errors (409)
export class ConflictError extends AppError {
  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.CONFLICT, message, 409, details);
  }
}

// Business rule violation errors (422)
export class BusinessError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.BUSINESS_RULE_VIOLATION,
    details?: Record<string, unknown>
  ) {
    super(code, message, 422, details);
  }
}

// External service errors (502)
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string,
    code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR,
    details?: Record<string, unknown>
  ) {
    super(code, `${service}: ${message}`, 502, { service, ...details });
  }
}

// Internal server errors (500)
export class InternalError extends AppError {
  constructor(
    message = 'An unexpected error occurred',
    details?: Record<string, unknown>
  ) {
    super(ErrorCode.INTERNAL_ERROR, message, 500, details, false);
  }
}

// Helper to check if an error is an operational AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Helper to create an error response from any error
export function createErrorResponse(error: unknown, requestId?: string): ErrorResponse {
  if (isAppError(error)) {
    const response = error.toJSON();
    if (requestId) {
      response.error.requestId = requestId;
    }
    return response;
  }

  // For non-AppError errors, return a generic internal error
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}
