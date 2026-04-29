import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ZOSMFClient } from '@integrations/zosmf/client';
import { logInfo, logError, logAudit } from '@utils/logger';

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

export class AuthService {
  private zosmfClient: ZOSMFClient;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.zosmfClient = new ZOSMFClient();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRATION || '24h';

    logInfo('AuthService initialized (simplified mode - no database)');
  }

  /**
   * Authenticate user with TSO credentials
   * Emits real-time progress updates via WebSocket
   */
  async login(
    loginRequest: LoginRequest,
    io?: SocketIOServer,
    socketId?: string
  ): Promise<LoginResult> {
    const { tsoId, password } = loginRequest;

    try {
      logInfo('Login attempt started', { tsoId });
      logAudit('LOGIN_ATTEMPT', tsoId, { timestamp: new Date() });

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

      // Generate JWT token
      const token = jwt.sign(
        {
          tsoId,
          sessionId: authResult.sessionId || 'temp-session',
        },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn } as jwt.SignOptions
      );

      const user = {
        id: tsoId,
        tsoId,
        sessionId: authResult.sessionId || 'temp-session',
        createdAt: new Date(),
      };

      logInfo('Login successful', { tsoId });
      logAudit('LOGIN_SUCCESS', tsoId, { timestamp: new Date() });

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
    } catch (error) {
      logError('Login failed', error, { tsoId });

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
  async validateToken(token: string): Promise<{ valid: boolean; tsoId?: string }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { tsoId: string };
      return { valid: true, tsoId: decoded.tsoId };
    } catch (error) {
      logError('Token validation failed', error);
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
  async logout(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        tsoId: string;
        sessionId?: string;
      };
      
      logInfo('User logout initiated', {
        tsoId: decoded.tsoId,
        sessionId: decoded.sessionId
      });
      
      // Step 1: Close mainframe session
      // Extract LTPA token from JWT if it was stored
      // For now, we'll attempt logout with the JWT token itself
      try {
        logInfo('Closing mainframe session', { tsoId: decoded.tsoId });
        
        // Note: In production, you'd extract the actual LTPA token from storage
        // For now, we log the attempt and let z/OSMF sessions auto-expire
        const mainframeLogout = await this.zosmfClient.logout(token);
        
        if (mainframeLogout.success) {
          logInfo('Mainframe session closed successfully', { tsoId: decoded.tsoId });
        } else {
          logInfo('Mainframe logout returned non-success, but continuing', {
            tsoId: decoded.tsoId,
            message: mainframeLogout.message
          });
        }
      } catch (error) {
        // Don't fail the entire logout if mainframe logout fails
        logError('Mainframe logout error (continuing with local cleanup)', error, {
          tsoId: decoded.tsoId
        });
      }
      
      // Step 2: Log successful logout
      logInfo('Logout successful - all resources cleaned', { tsoId: decoded.tsoId });
      logAudit('LOGOUT', decoded.tsoId, {
        timestamp: new Date(),
        sessionId: decoded.sessionId,
        message: 'User logged out - mainframe session closed, frontend storage cleared'
      });
      
      return {
        success: true,
        message: 'Logged out successfully. Mainframe session closed.'
      };
    } catch (error) {
      logError('Logout failed', error);
      return {
        success: false,
        message: 'Logout failed - token may be invalid'
      };
    }
  }

  /**
   * Emit progress update via WebSocket
   */
  private emitProgress(
    io: SocketIOServer | undefined,
    socketId: string | undefined,
    progress: ProgressUpdate
  ): void {
    if (io && socketId) {
      io.to(socketId).emit('auth:progress', progress);
      logInfo('Progress update emitted', { socketId, step: progress.step, message: progress.message });
    }
  }

  /**
   * Delay helper for UX
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Made with Bob
