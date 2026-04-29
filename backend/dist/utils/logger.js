"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWorkflow = exports.logJira = exports.logMainframe = exports.logPerformance = exports.logAudit = exports.logHttp = exports.logDebug = exports.logWarn = exports.logError = exports.logInfo = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const encryption_1 = require("./encryption");
/**
 * Winston logger configuration for OneTimer Bob
 * Provides structured logging with daily rotation and multiple transports
 */
const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Custom log format
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
        metaStr = '\n' + JSON.stringify((0, encryption_1.sanitizeForLogging)(meta), null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
}));
// Daily rotate file transport for all logs
const fileRotateTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(LOG_DIR, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
    level: LOG_LEVEL,
});
// Daily rotate file transport for error logs only
const errorFileRotateTransport = new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
    level: 'error',
});
// Create the logger instance
const logger = winston_1.default.createLogger({
    level: LOG_LEVEL,
    format: logFormat,
    defaultMeta: { service: 'onetimer-bob' },
    transports: [
        fileRotateTransport,
        errorFileRotateTransport,
    ],
    exceptionHandlers: [
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(LOG_DIR, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
        }),
    ],
    rejectionHandlers: [
        new winston_daily_rotate_file_1.default({
            filename: path_1.default.join(LOG_DIR, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
        }),
    ],
});
// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: consoleFormat,
    }));
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
const logInfo = (message, meta) => {
    logger.info(message, (0, encryption_1.sanitizeForLogging)(meta));
};
exports.logInfo = logInfo;
const logError = (message, error, meta) => {
    const errorMeta = {
        ...meta,
        error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
        } : error,
    };
    logger.error(message, (0, encryption_1.sanitizeForLogging)(errorMeta));
};
exports.logError = logError;
const logWarn = (message, meta) => {
    logger.warn(message, (0, encryption_1.sanitizeForLogging)(meta));
};
exports.logWarn = logWarn;
const logDebug = (message, meta) => {
    logger.debug(message, (0, encryption_1.sanitizeForLogging)(meta));
};
exports.logDebug = logDebug;
const logHttp = (message, meta) => {
    logger.http(message, (0, encryption_1.sanitizeForLogging)(meta));
};
exports.logHttp = logHttp;
// Audit logging for security-sensitive operations
const logAudit = (action, userId, details) => {
    logger.info('AUDIT', {
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...(0, encryption_1.sanitizeForLogging)(details),
    });
};
exports.logAudit = logAudit;
// Performance logging
const logPerformance = (operation, duration, meta) => {
    logger.info('PERFORMANCE', {
        operation,
        duration: `${duration}ms`,
        ...(0, encryption_1.sanitizeForLogging)(meta),
    });
};
exports.logPerformance = logPerformance;
// Mainframe operation logging
const logMainframe = (operation, tsoId, details) => {
    logger.info('MAINFRAME', {
        operation,
        tsoId,
        timestamp: new Date().toISOString(),
        ...(0, encryption_1.sanitizeForLogging)(details),
    });
};
exports.logMainframe = logMainframe;
// Jira operation logging
const logJira = (operation, issueKey, details) => {
    logger.info('JIRA', {
        operation,
        issueKey,
        timestamp: new Date().toISOString(),
        ...(0, encryption_1.sanitizeForLogging)(details),
    });
};
exports.logJira = logJira;
// Workflow logging
const logWorkflow = (workflowId, action, details) => {
    logger.info('WORKFLOW', {
        workflowId,
        action,
        timestamp: new Date().toISOString(),
        ...(0, encryption_1.sanitizeForLogging)(details),
    });
};
exports.logWorkflow = logWorkflow;
exports.default = logger;
// Made with Bob
//# sourceMappingURL=logger.js.map