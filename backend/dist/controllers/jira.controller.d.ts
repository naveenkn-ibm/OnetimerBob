import { Request, Response } from 'express';
export declare class JiraController {
    private jiraService;
    constructor();
    /**
     * Fetch Jira issue details via MCP
     * POST /api/jira/issue
     */
    getIssue(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=jira.controller.d.ts.map