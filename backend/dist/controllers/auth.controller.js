"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_simple_1 = require("@services/auth.service.simple");
const logger_1 = require("@utils/logger");
/**
 * Authentication Controller
 * Handles HTTP endpoints for authentication operations
 * Integrates with AuthService for business logic
 */
class AuthController {
    io;
    authService;
    constructor(io) {
        this.io = io;
        this.authService = new auth_service_simple_1.AuthService();
        (0, logger_1.logInfo)('AuthController initialized');
    }
    /**
     * POST /api/auth/login
     * Authenticate user with TSO credentials
     * Emits real-time progress updates via WebSocket
     */
    login = async (req, res) => {
        try {
            const { tsoId, password } = req.body;
            // Validation
            if (!tsoId || !password) {
                res.status(400).json({
                    success: false,
                    error: 'TSO ID and password are required',
                });
                return;
            }
            // Validate TSO ID format (Z##### format)
            const tsoIdRegex = /^Z[0-9A-F]{5}$/i;
            if (!tsoIdRegex.test(tsoId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid TSO ID format. Expected format: Z##### (e.g., Z86216)',
                });
                return;
            }
            (0, logger_1.logInfo)('Login request received', { tsoId });
            // Get socket ID from query parameter (if provided by frontend)
            const socketId = req.query.socketId;
            // Perform authentication with progress updates
            const result = await this.authService.login({ tsoId, password }, this.io, socketId);
            if (result.success) {
                res.status(200).json(result);
            }
            else {
                res.status(401).json(result);
            }
        }
        catch (error) {
            (0, logger_1.logError)('Login endpoint error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during authentication',
            });
        }
    };
    /**
     * POST /api/auth/logout
     * Logout user and invalidate session
     */
    logout = async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(400).json({
                    success: false,
                    message: 'No token provided',
                });
                return;
            }
            const result = await this.authService.logout(token);
            res.status(200).json(result);
        }
        catch (error) {
            (0, logger_1.logError)('Logout endpoint error', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during logout',
            });
        }
    };
    /**
     * POST /api/auth/refresh
     * Refresh session and extend expiration
     */
    refreshSession = async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'No token provided',
                });
                return;
            }
            // Refresh session not implemented in simplified service
            res.status(501).json({
                success: false,
                error: 'Session refresh not implemented in simplified mode',
            });
            return;
        }
        catch (error) {
            (0, logger_1.logError)('Refresh session endpoint error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during session refresh',
            });
        }
    };
    /**
     * GET /api/auth/validate
     * Validate JWT token and return user info
     */
    validateToken = async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(400).json({
                    valid: false,
                    error: 'No token provided',
                });
                return;
            }
            const result = await this.authService.validateToken(token);
            if (result.valid) {
                res.status(200).json(result);
            }
            else {
                res.status(401).json(result);
            }
        }
        catch (error) {
            (0, logger_1.logError)('Validate token endpoint error', error);
            res.status(500).json({
                valid: false,
                error: 'Internal server error during token validation',
            });
        }
    };
    /**
     * GET /api/auth/me
     * Get current user information
     */
    getCurrentUser = async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'No token provided',
                });
                return;
            }
            const validation = await this.authService.validateToken(token);
            if (!validation.valid) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                });
                return;
            }
            res.status(200).json({
                success: true,
                tsoId: validation.tsoId,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Get current user endpoint error', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    };
}
exports.AuthController = AuthController;
// Made with Bob
//# sourceMappingURL=auth.controller.js.map