import winston from 'winston';
declare const logger: winston.Logger;
/**
 * Log levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages
 * - http: HTTP request logs
 * - debug: Debug messages
 */
export declare const logInfo: (message: string, meta?: any) => void;
export declare const logError: (message: string, error?: Error | any, meta?: any) => void;
export declare const logWarn: (message: string, meta?: any) => void;
export declare const logDebug: (message: string, meta?: any) => void;
export declare const logHttp: (message: string, meta?: any) => void;
export declare const logAudit: (action: string, userId: string, details?: any) => void;
export declare const logPerformance: (operation: string, duration: number, meta?: any) => void;
export declare const logMainframe: (operation: string, tsoId: string, details?: any) => void;
export declare const logJira: (operation: string, issueKey: string, details?: any) => void;
export declare const logWorkflow: (workflowId: string, action: string, details?: any) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map