// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { AuthController } from '@controllers/auth.controller';
import { JiraController } from '@controllers/jira.controller';
import { AIController } from '@controllers/ai.controller';
import { logInfo, logError } from '@utils/logger';

/**
 * OneTimer Bob Backend Server
 * Express + Socket.IO for real-time communication
 * Integrates with z/OSMF for mainframe operations
 */

const app: Express = express();
const httpServer = createServer(app);

// Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logInfo('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Initialize controllers
const authController = new AuthController(io);
const jiraController = new JiraController();
const aiController = new AIController(io);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'OneTimer Bob backend is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiRouter = express.Router();

// Authentication routes
apiRouter.post('/auth/login', authController.login);
apiRouter.post('/auth/logout', authController.logout);
apiRouter.post('/auth/refresh', authController.refreshSession);
apiRouter.get('/auth/validate', authController.validateToken);
apiRouter.get('/auth/me', authController.getCurrentUser);

// Jira routes
apiRouter.post('/jira/issue', jiraController.getIssue.bind(jiraController));

// AI Analysis routes
apiRouter.post('/ai/analyze', aiController.analyzeCSR);
apiRouter.post('/ai/reanalyze', aiController.reanalyze);
apiRouter.get('/ai/status', aiController.getStatus);

// Mount API router
app.use('/api', apiRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logError('Unhandled error', err, {
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logInfo('Client connected', { socketId: socket.id });

  socket.on('disconnect', () => {
    logInfo('Client disconnected', { socketId: socket.id });
  });

  // Handle authentication progress subscription
  socket.on('auth:subscribe', () => {
    logInfo('Client subscribed to auth progress', { socketId: socket.id });
    socket.emit('auth:subscribed', { socketId: socket.id });
  });

  // Handle ping for connection testing
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 OneTimer Bob Backend Server');
  console.log('========================================');
  console.log(`Server running on: http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`z/OSMF Host: ${process.env.ZOSMF_HOST || '204.90.115.200'}`);
  console.log(`z/OSMF Port: ${process.env.ZOSMF_PORT || '10443'}`);
  console.log('');
  console.log('📡 WebSocket server ready for real-time updates');
  console.log('');
  console.log('API Endpoints:');
  console.log('  POST   /api/auth/login');
  console.log('  POST   /api/auth/logout');
  console.log('  POST   /api/auth/refresh');
  console.log('  GET    /api/auth/validate');
  console.log('  GET    /api/auth/me');
  console.log('  POST   /api/jira/issue');
  console.log('  POST   /api/ai/analyze');
  console.log('  POST   /api/ai/reanalyze');
  console.log('  GET    /api/ai/status');
  console.log('  GET    /health');
  console.log('');
  console.log('💡 To stop the server: Press Ctrl+C');
  console.log('========================================');

  logInfo('Server started successfully', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logInfo('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logInfo('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logError('Uncaught exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logError('Unhandled rejection', new Error(reason));
  process.exit(1);
});

export { app, httpServer, io };

// Made with Bob
