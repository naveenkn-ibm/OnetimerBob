import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
/**
 * OneTimer Bob Backend Server
 * Express + Socket.IO for real-time communication
 * Integrates with z/OSMF for mainframe operations
 */
declare const app: Express;
declare const httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, httpServer, io };
//# sourceMappingURL=server.d.ts.map