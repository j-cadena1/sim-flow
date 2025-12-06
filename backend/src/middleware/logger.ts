import winston from 'winston';

// Custom format for structured logging
const structuredFormat = winston.format.printf(({ level, message, timestamp, requestId, userId, ...meta }) => {
  const logEntry: Record<string, unknown> = {
    timestamp,
    level,
    message,
  };

  // Add correlation IDs if present
  if (requestId) logEntry.requestId = requestId;
  if (userId) logEntry.userId = userId;

  // Add any additional metadata
  if (Object.keys(meta).length > 0) {
    logEntry.meta = meta;
  }

  return JSON.stringify(logEntry);
});

// Console format for development
const devFormat = winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqIdStr = requestId ? `[${requestId}] ` : '';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${reqIdStr}${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    structuredFormat
  ),
  defaultMeta: {
    service: 'sim-flow-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            structuredFormat
          )
        : winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
            winston.format.colorize(),
            devFormat
          ),
    }),
  ],
});

// Log to file in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        structuredFormat
      ),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        structuredFormat
      ),
    })
  );
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    userId,
  });
}

/**
 * Log levels:
 * - error: For errors that need immediate attention
 * - warn: For potentially harmful situations
 * - info: For general information about application flow
 * - http: For HTTP request/response logging
 * - debug: For debugging information
 */
