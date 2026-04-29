import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { sanitizeForLogging } from './encryption';

/**
 * Winston logger configuration for OneTimer Bob
 * Provides structured logging with daily rotation and multiple transports
 */

const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(sanitizeForLogging(meta), null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Daily rotate file transport for all logs
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: LOG_LEVEL,
});

// Daily rotate file transport for error logs only
const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error',
});

// Create the logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'onetimer-bob' },
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Log levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages
 * - http: HTTP request logs
 * - debug: Debug messages
 */

// Helper functions for structured logging
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, sanitizeForLogging(meta));
};

export const logError = (message: string, error?: Error | any, meta?: any) => {
  const errorMeta = {
    ...meta,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error,
  };
  logger.error(message, sanitizeForLogging(errorMeta));
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, sanitizeForLogging(meta));
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, sanitizeForLogging(meta));
};

export const logHttp = (message: string, meta?: any) => {
  logger.http(message, sanitizeForLogging(meta));
};

// Audit logging for security-sensitive operations
export const logAudit = (action: string, userId: string, details?: any) => {
  logger.info('AUDIT', {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...sanitizeForLogging(details),
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, meta?: any) => {
  logger.info('PERFORMANCE', {
    operation,
    duration: `${duration}ms`,
    ...sanitizeForLogging(meta),
  });
};

// Mainframe operation logging
export const logMainframe = (operation: string, tsoId: string, details?: any) => {
  logger.info('MAINFRAME', {
    operation,
    tsoId,
    timestamp: new Date().toISOString(),
    ...sanitizeForLogging(details),
  });
};

// Jira operation logging
export const logJira = (operation: string, issueKey: string, details?: any) => {
  logger.info('JIRA', {
    operation,
    issueKey,
    timestamp: new Date().toISOString(),
    ...sanitizeForLogging(details),
  });
};

// Workflow logging
export const logWorkflow = (workflowId: string, action: string, details?: any) => {
  logger.info('WORKFLOW', {
    workflowId,
    action,
    timestamp: new Date().toISOString(),
    ...sanitizeForLogging(details),
  });
};

export default logger;

// Made with Bob
