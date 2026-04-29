import { Server as SocketIOServer } from 'socket.io';
/**
 * Authentication Service
 * Handles TSO login with real-time progress feedback via WebSocket
 * Integrates with existing z/OSMF client implementation
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
     *
     * @param loginRequest - TSO ID and password
     * @param io - Socket.IO server instance for progress updates
     * @param socketId - Optional socket ID for targeted updates
     * @returns Login result with JWT token
     */
    login(loginRequest: LoginRequest, io?: SocketIOServer, socketId?: string): Promise<LoginResult>;
    /**
     * Validate JWT token and retrieve session
     * @param token - JWT token
     * @returns User and session information
     */
    validateToken(token: string): Promise<{
        valid: boolean;
        user?: any;
        session?: any;
        error?: string;
    }>;
    /**
     * Logout user and invalidate session
     * @param token - JWT token
     */
    logout(token: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Refresh session and extend expiration
     * @param token - Current JWT token
     * @returns New token
     */
    refreshSession(token: string): Promise<{
        success: boolean;
        token?: string;
        error?: string;
    }>;
    /**
     * Get decrypted TSO credentials for a user
     * Used for subsequent mainframe operations
     * @param userId - User ID
     * @returns Decrypted TSO credentials
     */
    getCredentials(userId: string): Promise<{
        tsoId: string;
        password: string;
    } | null>;
    /**
     * Generate JWT token
     * @param payload - Token payload
     * @returns JWT token string
     */
    private generateToken;
    /**
     * Emit progress update via WebSocket
     * @param io - Socket.IO server instance
     * @param socketId - Optional socket ID for targeted updates
     * @param progress - Progress update data
     */
    private emitProgress;
    /**
     * Utility delay function for UX timing
     * @param ms - Milliseconds to delay
     */
    private delay;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map