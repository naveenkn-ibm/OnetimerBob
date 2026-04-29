// import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ZOSMFClient } from '@integrations/zosmf/client';
import { encrypt, decrypt } from '@utils/encryption';
import { logInfo, logError, logAudit } from '@utils/logger';

// const prisma = new PrismaClient();
// TODO: Initialize Prisma when database is set up

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

export class AuthService {
  private zosmfClient: ZOSMFClient;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.zosmfClient = new ZOSMFClient();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

    logInfo('AuthService initialized');
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
        logError('Mainframe authentication failed', new Error(authResult.error || 'Unknown error'), { tsoId });
        logAudit('LOGIN_FAILED', tsoId, { reason: authResult.error });

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
      const encryptedPassword = await encrypt(password);

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
        logInfo('New user created', { tsoId, userId: user.id });
      } else {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            encryptedPassword,
            lastLogin: new Date(),
          },
        });
        logInfo('Existing user updated', { tsoId, userId: user.id });
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

      logInfo('Session created', { tsoId, userId: user.id, sessionId: session.id });
      logAudit('LOGIN_SUCCESS', tsoId, { 
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

    } catch (error) {
      logError('Login failed with exception', error, { tsoId });
      logAudit('LOGIN_ERROR', tsoId, { error: error instanceof Error ? error.message : 'Unknown error' });

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
  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: any;
    session?: any;
    error?: string;
  }> {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as any;

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

    } catch (error) {
      logError('Token validation failed', error);
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
  async logout(token: string): Promise<{ success: boolean; message: string }> {
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

        logInfo('User logged out', { tsoId: session.user.tsoId, sessionId: session.id });
        logAudit('LOGOUT', session.user.tsoId, { sessionId: session.id });
      }

      return {
        success: true,
        message: 'Logged out successfully',
      };

    } catch (error) {
      logError('Logout failed', error);
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
  async refreshSession(token: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
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

      logInfo('Session refreshed', { 
        tsoId: validation.user.tsoId, 
        sessionId: validation.session.id 
      });

      return {
        success: true,
        token: newToken,
      };

    } catch (error) {
      logError('Session refresh failed', error);
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
  async getCredentials(userId: string): Promise<{
    tsoId: string;
    password: string;
  } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return null;
      }

      const password = await decrypt(user.encryptedPassword);

      return {
        tsoId: user.tsoId,
        password,
      };

    } catch (error) {
      logError('Failed to get credentials', error, { userId });
      return null;
    }
  }

  /**
   * Generate JWT token
   * @param payload - Token payload
   * @returns JWT token string
   */
  private generateToken(payload: { userId: string; tsoId: string }): string {
    return jwt.sign(
      payload,
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as jwt.SignOptions
    );
  }

  /**
   * Emit progress update via WebSocket
   * @param io - Socket.IO server instance
   * @param socketId - Optional socket ID for targeted updates
   * @param progress - Progress update data
   */
  private emitProgress(
    io: SocketIOServer | undefined,
    socketId: string | undefined,
    progress: ProgressUpdate
  ): void {
    if (!io) return;

    const event = 'auth:progress';

    if (socketId) {
      // Send to specific socket
      io.to(socketId).emit(event, progress);
    } else {
      // Broadcast to all connected clients
      io.emit(event, progress);
    }

    logInfo('Progress update emitted', { 
      step: progress.step, 
      message: progress.message,
      socketId: socketId || 'broadcast'
    });
  }

  /**
   * Utility delay function for UX timing
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const authService = new AuthService();

// Made with Bob
