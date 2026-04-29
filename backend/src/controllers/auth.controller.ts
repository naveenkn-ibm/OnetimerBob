import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthService, LoginRequest } from '@services/auth.service.simple';
import { logInfo, logError } from '@utils/logger';

/**
 * Authentication Controller
 * Handles HTTP endpoints for authentication operations
 * Integrates with AuthService for business logic
 */

export class AuthController {
  private io: SocketIOServer;
  private authService: AuthService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.authService = new AuthService();
    logInfo('AuthController initialized');
  }

  /**
   * POST /api/auth/login
   * Authenticate user with TSO credentials
   * Emits real-time progress updates via WebSocket
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tsoId, password } = req.body as LoginRequest;

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

      logInfo('Login request received', { tsoId });

      // Get socket ID from query parameter (if provided by frontend)
      const socketId = req.query.socketId as string | undefined;

      // Perform authentication with progress updates
      const result = await this.authService.login(
        { tsoId, password },
        this.io,
        socketId
      );

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(401).json(result);
      }

    } catch (error) {
      logError('Login endpoint error', error);
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
  logout = async (req: Request, res: Response): Promise<void> => {
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

    } catch (error) {
      logError('Logout endpoint error', error);
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
  refreshSession = async (req: Request, res: Response): Promise<void> => {
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

    } catch (error) {
      logError('Refresh session endpoint error', error);
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
  validateToken = async (req: Request, res: Response): Promise<void> => {
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
      } else {
        res.status(401).json(result);
      }

    } catch (error) {
      logError('Validate token endpoint error', error);
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
  getCurrentUser = async (req: Request, res: Response): Promise<void> => {
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

    } catch (error) {
      logError('Get current user endpoint error', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  };
}

// Made with Bob
