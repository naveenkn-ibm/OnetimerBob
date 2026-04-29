import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
/**
 * Authentication Controller
 * Handles HTTP endpoints for authentication operations
 * Integrates with AuthService for business logic
 */
export declare class AuthController {
    private io;
    private authService;
    constructor(io: SocketIOServer);
    /**
     * POST /api/auth/login
     * Authenticate user with TSO credentials
     * Emits real-time progress updates via WebSocket
     */
    login: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/auth/logout
     * Logout user and invalidate session
     */
    logout: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/auth/refresh
     * Refresh session and extend expiration
     */
    refreshSession: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/auth/validate
     * Validate JWT token and return user info
     */
    validateToken: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/auth/me
     * Get current user information
     */
    getCurrentUser: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map