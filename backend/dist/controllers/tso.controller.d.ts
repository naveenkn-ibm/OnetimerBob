import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
export declare class TSOController {
    private io;
    private authService;
    constructor(io: SocketIOServer);
    /** Delegate step approval to the execution service */
    approveStep(socketId: string, editedJcl?: string): void;
    executeTSO: (req: Request, res: Response) => Promise<void>;
    getJobStatus: (req: Request, res: Response) => Promise<void>;
    getSpoolContent: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=tso.controller.d.ts.map