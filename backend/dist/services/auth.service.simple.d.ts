import { Server as SocketIOServer } from 'socket.io';
/**
 * Simplified Authentication Service (No Database)
 * Handles TSO login with real-time progress feedback via WebSocket
 * For initial testing without Prisma/Database setup
 */
export interface LoginRequest {
    tsoId: string;
    password: string;
}
export interface LoginResult {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        tsoId: string;
        createdAt: Date;
    };
    error?: string;
    message?: string;
}
export interface ProgressUpdate {
    step: number;
    totalSteps: number;
    message: string;
    percentage: number;
    status: 'in_progress' | 'completed' | 'error';
}
export declare class AuthService {
    private zosmfClient;
    private jwtSecret;
    private jwtExpiresIn;
    constructor();
    /**
     * Authenticate user with TSO credentials
     * Emits real-time progress updates via WebSocket
     */
    login(loginRequest: LoginRequest, io?: SocketIOServer, socketId?: string): Promise<LoginResult>;
    /**
     * Validate JWT token
     */
    validateToken(token: string): Promise<{
        valid: boolean;
        tsoId?: string;
    }>;
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
    logout(token: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Emit progress update via WebSocket
     */
    private emitProgress;
    /**
     * Delay helper for UX
     */
    private delay;
}
//# sourceMappingURL=auth.service.simple.d.ts.map