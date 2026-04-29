"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraController = void 0;
const jira_service_1 = require("../services/jira.service");
const logger_1 = require("../utils/logger");
class JiraController {
    jiraService;
    constructor() {
        this.jiraService = new jira_service_1.JiraService();
    }
    /**
     * Fetch Jira issue details via MCP
     * POST /api/jira/issue
     */
    async getIssue(req, res) {
        try {
            const { issueKey } = req.body;
            // Validate input
            if (!issueKey) {
                res.status(400).json({
                    success: false,
                    message: 'Issue key is required. Please provide a valid Jira issue key (e.g., BTP-2, PROJ-123)',
                });
                return;
            }
            // Trim whitespace
            const trimmedKey = issueKey.trim();
            (0, logger_1.logInfo)('Fetching Jira issue via MCP', { issueKey: trimmedKey });
            // Fetch issue from Jira via MCP
            const issueData = await this.jiraService.getIssue(trimmedKey);
            // Generate XML representation
            const xmlData = this.jiraService.generateXML(issueData);
            (0, logger_1.logInfo)('Successfully fetched Jira issue', { issueKey: trimmedKey });
            res.status(200).json({
                success: true,
                data: issueData,
                xml: xmlData,
                message: 'Issue retrieved successfully',
            });
        }
        catch (error) {
            const issueKey = req.body?.issueKey || 'unknown';
            (0, logger_1.logError)('Failed to fetch Jira issue', error, { issueKey });
            // Extract error message
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch issue';
            // Determine appropriate status code based on error type
            let statusCode = 500;
            if (errorMessage.includes('Invalid issue key format') ||
                errorMessage.includes('cannot be empty')) {
                statusCode = 400; // Bad Request
            }
            else if (errorMessage.includes('not found') ||
                errorMessage.includes('does not exist')) {
                statusCode = 404; // Not Found
            }
            else if (errorMessage.includes('Access denied') ||
                errorMessage.includes('permission')) {
                statusCode = 403; // Forbidden
            }
            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: errorMessage,
                data: null,
                xml: null,
            });
        }
    }
}
exports.JiraController = JiraController;
// Made with Bob
//# sourceMappingURL=jira.controller.js.map