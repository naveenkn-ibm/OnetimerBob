"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_controller_1 = require("@controllers/auth.controller");
const jira_controller_1 = require("@controllers/jira.controller");
const logger_1 = require("@utils/logger");
// Load environment variables
dotenv_1.default.config();
/**
 * OneTimer Bob Backend Server
 * Express + Socket.IO for real-time communication
 * Integrates with z/OSMF for mainframe operations
 */
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Socket.IO configuration
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, _res, next) => {
    (0, logger_1.logInfo)('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
});
// Initialize controllers
const authController = new auth_controller_1.AuthController(io);
const jiraController = new jira_controller_1.JiraController();
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'OneTimer Bob backend is running',
        timestamp: new Date().toISOString(),
    });
});
// API Routes
const apiRouter = express_1.default.Router();
// Authentication routes
apiRouter.post('/auth/login', authController.login);
apiRouter.post('/auth/logout', authController.logout);
apiRouter.post('/auth/refresh', authController.refreshSession);
apiRouter.get('/auth/validate', authController.validateToken);
apiRouter.get('/auth/me', authController.getCurrentUser);
// Jira routes
apiRouter.post('/jira/issue', jiraController.getIssue.bind(jiraController));
// Mount API router
app.use('/api', apiRouter);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
    });
});
// Error handling middleware
app.use((err, req, res, _next) => {
    (0, logger_1.logError)('Unhandled error', err, {
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
    (0, logger_1.logInfo)('Client connected', { socketId: socket.id });
    socket.on('disconnect', () => {
        (0, logger_1.logInfo)('Client disconnected', { socketId: socket.id });
    });
    // Handle authentication progress subscription
    socket.on('auth:subscribe', () => {
        (0, logger_1.logInfo)('Client subscribed to auth progress', { socketId: socket.id });
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
    console.log('  GET    /health');
    console.log('');
    console.log('💡 To stop the server: Press Ctrl+C');
    console.log('========================================');
    (0, logger_1.logInfo)('Server started successfully', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV || 'development',
    });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    (0, logger_1.logInfo)('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
        (0, logger_1.logInfo)('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    (0, logger_1.logInfo)('SIGINT received, shutting down gracefully');
    httpServer.close(() => {
        (0, logger_1.logInfo)('Server closed');
        process.exit(0);
    });
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    (0, logger_1.logError)('Uncaught exception', error);
    process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    (0, logger_1.logError)('Unhandled rejection', new Error(reason));
    process.exit(1);
});
// Made with Bob
//# sourceMappingURL=server.js.map