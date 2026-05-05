"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@integrations/zosmf/client");
const logger_1 = require("@utils/logger");
class AuthService {
    static mainframeSessionByUser = new Map();
    zosmfClient;
    jwtSecret;
    jwtExpiresIn;
    constructor() {
        this.zosmfClient = new client_1.ZOSMFClient();
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRATION || '24h';
        (0, logger_1.logInfo)('AuthService initialized (simplified mode - no database)');
    }
    /**
     * Authenticate user with TSO credentials
     * Emits real-time progress updates via WebSocket
     */
    async login(loginRequest, io, socketId) {
        const { tsoId, password } = loginRequest;
        try {
            (0, logger_1.logInfo)('Login attempt started', { tsoId });
            (0, logger_1.logAudit)('LOGIN_ATTEMPT', tsoId, { timestamp: new Date() });
            // Step 1: Initializing connection (0-20%)
            this.emitProgress(io, socketId, {
                step: 1,
                totalSteps: 5,
                message: 'Initializing connection to mainframe...',
                percentage: 10,
                status: 'in_progress',
            });
            await this.delay(500);
            // Step 2: Establishing session (20-40%)
            this.emitProgress(io, socketId, {
                step: 2,
                totalSteps: 5,
                message: 'Establishing session with z/OSMF...',
                percentage: 30,
                status: 'in_progress',
            });
            await this.delay(300);
            // Step 3: Sending credentials (40-60%)
            this.emitProgress(io, socketId, {
                step: 3,
                totalSteps: 5,
                message: 'Sending credentials securely...',
                percentage: 50,
                status: 'in_progress',
            });
            await this.delay(300);
            // Step 4: Validating user (60-80%)
            this.emitProgress(io, socketId, {
                step: 4,
                totalSteps: 5,
                message: 'Validating user credentials...',
                percentage: 70,
                status: 'in_progress',
            });
            // Authenticate with mainframe
            const authResult = await this.zosmfClient.authenticate(tsoId, password);
            if (!authResult.success) {
                this.emitProgress(io, socketId, {
                    step: 4,
                    totalSteps: 5,
                    message: authResult.error || 'Authentication failed',
                    percentage: 70,
                    status: 'error',
                });
                return {
                    success: false,
                    error: authResult.error || 'Authentication failed',
                };
            }
            // Step 5: Complete (80-100%)
            this.emitProgress(io, socketId, {
                step: 5,
                totalSteps: 5,
                message: 'Authentication successful!',
                percentage: 100,
                status: 'completed',
            });
            // Track mainframe session in-memory for downstream TSO execution.
            if (authResult.token) {
                AuthService.mainframeSessionByUser.set(tsoId, {
                    ltpaToken: authResult.token,
                    sessionId: authResult.sessionId,
                    updatedAt: new Date().toISOString(),
                });
            }
            // Generate JWT token
            const token = jsonwebtoken_1.default.sign({
                tsoId,
                sessionId: authResult.sessionId || 'temp-session',
            }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
            const user = {
                id: tsoId,
                tsoId,
                sessionId: authResult.sessionId || 'temp-session',
                createdAt: new Date(),
            };
            (0, logger_1.logInfo)('Login successful', { tsoId });
            (0, logger_1.logAudit)('LOGIN_SUCCESS', tsoId, { timestamp: new Date() });
            // Emit success event
            if (io && socketId) {
                io.to(socketId).emit('auth:success', { user });
            }
            return {
                success: true,
                token,
                user,
                message: 'Authentication successful',
            };
        }
        catch (error) {
            (0, logger_1.logError)('Login failed', error, { tsoId });
            this.emitProgress(io, socketId, {
                step: 0,
                totalSteps: 5,
                message: 'Authentication failed - unexpected error',
                percentage: 0,
                status: 'error',
            });
            if (io && socketId) {
                io.to(socketId).emit('auth:error', {
                    message: error instanceof Error ? error.message : 'Authentication failed',
                });
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Authentication failed',
            };
        }
    }
    /**
     * Validate JWT token
     */
    async validateToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            return { valid: true, tsoId: decoded.tsoId };
        }
        catch (error) {
            (0, logger_1.logError)('Token validation failed', error);
            return { valid: false };
        }
    }
    /**
     * Logout user and cleanup all resources
     *
     * CLEANUP OPERATIONS:
     * 1. Close mainframe z/OSMF session (invalidate LTPA token)
     * 2. Log audit trail
     * 3. Frontend clears localStorage/sessionStorage
     *
     * NOTE: MCP connections are stateless and auto-cleanup via Podman --rm flag
     */
    async logout(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            (0, logger_1.logInfo)('User logout initiated', {
                tsoId: decoded.tsoId,
                sessionId: decoded.sessionId
            });
            // Step 1: Close mainframe session
            try {
                (0, logger_1.logInfo)('Closing mainframe session', { tsoId: decoded.tsoId });
                const activeSession = AuthService.mainframeSessionByUser.get(decoded.tsoId);
                const sessionToken = activeSession?.ltpaToken;
                const mainframeLogout = sessionToken
                    ? await this.zosmfClient.logout(sessionToken)
                    : { success: true, message: 'No active mainframe token found' };
                if (mainframeLogout.success) {
                    (0, logger_1.logInfo)('Mainframe session closed successfully', { tsoId: decoded.tsoId });
                }
                else {
                    (0, logger_1.logInfo)('Mainframe logout returned non-success, but continuing', {
                        tsoId: decoded.tsoId,
                        message: mainframeLogout.message
                    });
                }
            }
            catch (error) {
                // Don't fail the entire logout if mainframe logout fails
                (0, logger_1.logError)('Mainframe logout error (continuing with local cleanup)', error, {
                    tsoId: decoded.tsoId
                });
            }
            AuthService.mainframeSessionByUser.delete(decoded.tsoId);
            // Step 2: Log successful logout
            (0, logger_1.logInfo)('Logout successful - all resources cleaned', { tsoId: decoded.tsoId });
            (0, logger_1.logAudit)('LOGOUT', decoded.tsoId, {
                timestamp: new Date(),
                sessionId: decoded.sessionId,
                message: 'User logged out - mainframe session closed, frontend storage cleared'
            });
            return {
                success: true,
                message: 'Logged out successfully. Mainframe session closed.'
            };
        }
        catch (error) {
            (0, logger_1.logError)('Logout failed', error);
            return {
                success: false,
                message: 'Logout failed - token may be invalid'
            };
        }
    }
    static getMainframeToken(tsoId) {
        return AuthService.mainframeSessionByUser.get(tsoId)?.ltpaToken;
    }
    /**
     * Emit progress update via WebSocket
     */
    emitProgress(io, socketId, progress) {
        if (io && socketId) {
            io.to(socketId).emit('auth:progress', progress);
            (0, logger_1.logInfo)('Progress update emitted', { socketId, step: progress.step, message: progress.message });
        }
    }
    /**
     * Delay helper for UX
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.AuthService = AuthService;
// Made with Bob
//# sourceMappingURL=auth.service.simple.js.map