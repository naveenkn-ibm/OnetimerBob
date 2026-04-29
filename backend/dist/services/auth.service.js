"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@integrations/zosmf/client");
const encryption_1 = require("@utils/encryption");
const logger_1 = require("@utils/logger");
class AuthService {
    zosmfClient;
    jwtSecret;
    jwtExpiresIn;
    constructor() {
        this.zosmfClient = new client_1.ZOSMFClient();
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        (0, logger_1.logInfo)('AuthService initialized');
    }
    /**
     * Authenticate user with TSO credentials
     * Emits real-time progress updates via WebSocket
     *
     * @param loginRequest - TSO ID and password
     * @param io - Socket.IO server instance for progress updates
     * @param socketId - Optional socket ID for targeted updates
     * @returns Login result with JWT token
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
            await this.delay(500); // Brief delay for UX
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
            // Authenticate with mainframe using existing z/OSMF client
            const authResult = await this.zosmfClient.authenticate(tsoId, password);
            if (!authResult.success) {
                (0, logger_1.logError)('Mainframe authentication failed', new Error(authResult.error || 'Unknown error'), { tsoId });
                (0, logger_1.logAudit)('LOGIN_FAILED', tsoId, { reason: authResult.error });
                this.emitProgress(io, socketId, {
                    step: 3,
                    totalSteps: 5,
                    message: authResult.error || 'Authentication failed',
                    percentage: 50,
                    status: 'error',
                });
                return {
                    success: false,
                    error: authResult.error || 'Authentication failed',
                };
            }
            // Step 4: Validating user (60-80%)
            this.emitProgress(io, socketId, {
                step: 4,
                totalSteps: 5,
                message: 'Validating user credentials...',
                percentage: 70,
                status: 'in_progress',
            });
            // Encrypt password for storage
            const encryptedPassword = await (0, encryption_1.encrypt)(password);
            // Check if user exists
            let user = await prisma.user.findUnique({
                where: { tsoId },
            });
            if (!user) {
                // Create new user
                user = await prisma.user.create({
                    data: {
                        tsoId,
                        encryptedPassword,
                        lastLogin: new Date(),
                    },
                });
                (0, logger_1.logInfo)('New user created', { tsoId, userId: user.id });
            }
            else {
                // Update existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        encryptedPassword,
                        lastLogin: new Date(),
                    },
                });
                (0, logger_1.logInfo)('Existing user updated', { tsoId, userId: user.id });
            }
            // Step 5: Creating session (80-100%)
            this.emitProgress(io, socketId, {
                step: 5,
                totalSteps: 5,
                message: 'Creating secure session...',
                percentage: 90,
                status: 'in_progress',
            });
            // Generate JWT token
            const token = this.generateToken({
                userId: user.id,
                tsoId: user.tsoId,
            });
            // Store session in database
            const session = await prisma.session.create({
                data: {
                    userId: user.id,
                    token,
                    ltpaToken: authResult.token || '',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                },
            });
            (0, logger_1.logInfo)('Session created', { tsoId, userId: user.id, sessionId: session.id });
            (0, logger_1.logAudit)('LOGIN_SUCCESS', tsoId, {
                userId: user.id,
                sessionId: session.id,
                zosmfInfo: authResult.message
            });
            // Final progress update
            this.emitProgress(io, socketId, {
                step: 5,
                totalSteps: 5,
                message: 'Authentication complete! Redirecting...',
                percentage: 100,
                status: 'completed',
            });
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    tsoId: user.tsoId,
                    createdAt: user.createdAt,
                },
                message: 'Login successful',
            };
        }
        catch (error) {
            (0, logger_1.logError)('Login failed with exception', error, { tsoId });
            (0, logger_1.logAudit)('LOGIN_ERROR', tsoId, { error: error instanceof Error ? error.message : 'Unknown error' });
            this.emitProgress(io, socketId, {
                step: 0,
                totalSteps: 5,
                message: 'Authentication failed - Please try again',
                percentage: 0,
                status: 'error',
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Authentication failed',
            };
        }
    }
    /**
     * Validate JWT token and retrieve session
     * @param token - JWT token
     * @returns User and session information
     */
    async validateToken(token) {
        try {
            // Verify JWT
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            // Check if session exists and is not expired
            const session = await prisma.session.findFirst({
                where: {
                    token,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                include: {
                    user: true,
                },
            });
            if (!session) {
                return {
                    valid: false,
                    error: 'Session expired or invalid',
                };
            }
            return {
                valid: true,
                user: session.user,
                session,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Token validation failed', error);
            return {
                valid: false,
                error: 'Invalid token',
            };
        }
    }
    /**
     * Logout user and invalidate session
     * @param token - JWT token
     */
    async logout(token) {
        try {
            // Find and delete session
            const session = await prisma.session.findFirst({
                where: { token },
                include: { user: true },
            });
            if (session) {
                await prisma.session.delete({
                    where: { id: session.id },
                });
                (0, logger_1.logInfo)('User logged out', { tsoId: session.user.tsoId, sessionId: session.id });
                (0, logger_1.logAudit)('LOGOUT', session.user.tsoId, { sessionId: session.id });
            }
            return {
                success: true,
                message: 'Logged out successfully',
            };
        }
        catch (error) {
            (0, logger_1.logError)('Logout failed', error);
            return {
                success: false,
                message: 'Logout failed',
            };
        }
    }
    /**
     * Refresh session and extend expiration
     * @param token - Current JWT token
     * @returns New token
     */
    async refreshSession(token) {
        try {
            const validation = await this.validateToken(token);
            if (!validation.valid || !validation.session) {
                return {
                    success: false,
                    error: 'Invalid or expired session',
                };
            }
            // Generate new token
            const newToken = this.generateToken({
                userId: validation.user.id,
                tsoId: validation.user.tsoId,
            });
            // Update session
            await prisma.session.update({
                where: { id: validation.session.id },
                data: {
                    token: newToken,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            });
            (0, logger_1.logInfo)('Session refreshed', {
                tsoId: validation.user.tsoId,
                sessionId: validation.session.id
            });
            return {
                success: true,
                token: newToken,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Session refresh failed', error);
            return {
                success: false,
                error: 'Failed to refresh session',
            };
        }
    }
    /**
     * Get decrypted TSO credentials for a user
     * Used for subsequent mainframe operations
     * @param userId - User ID
     * @returns Decrypted TSO credentials
     */
    async getCredentials(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });
            if (!user) {
                return null;
            }
            const password = await (0, encryption_1.decrypt)(user.encryptedPassword);
            return {
                tsoId: user.tsoId,
                password,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get credentials', error, { userId });
            return null;
        }
    }
    /**
     * Generate JWT token
     * @param payload - Token payload
     * @returns JWT token string
     */
    generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }
    /**
     * Emit progress update via WebSocket
     * @param io - Socket.IO server instance
     * @param socketId - Optional socket ID for targeted updates
     * @param progress - Progress update data
     */
    emitProgress(io, socketId, progress) {
        if (!io)
            return;
        const event = 'auth:progress';
        if (socketId) {
            // Send to specific socket
            io.to(socketId).emit(event, progress);
        }
        else {
            // Broadcast to all connected clients
            io.emit(event, progress);
        }
        (0, logger_1.logInfo)('Progress update emitted', {
            step: progress.step,
            message: progress.message,
            socketId: socketId || 'broadcast'
        });
    }
    /**
     * Utility delay function for UX timing
     * @param ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AuthService = AuthService;
// Export singleton instance
exports.authService = new AuthService();
// Made with Bob
//# sourceMappingURL=auth.service.js.map