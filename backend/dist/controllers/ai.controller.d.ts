import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
/**
 * AI Controller for Step 4
 * Handles AI-powered analysis endpoints
 */
export declare class AIController {
    private io;
    constructor(io: SocketIOServer);
    /**
     * POST /api/ai/analyze
     * Analyze CSR/Jira content and extract intent + entities
     */
    analyzeCSR: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/ai/reanalyze
     * Re-analyze with user corrections
     */
    reanalyze: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/ai/status
     * Check AI service availability
     */
    getStatus: (_req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=ai.controller.d.ts.map