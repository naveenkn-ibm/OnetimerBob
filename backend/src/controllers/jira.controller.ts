import { Request, Response } from 'express';
import { JiraService } from '../services/jira.service';
import { logInfo, logError } from '../utils/logger';

export class JiraController {
  private jiraService: JiraService;

  constructor() {
    this.jiraService = new JiraService();
  }

  /**
   * Fetch Jira issue details via MCP
   * POST /api/jira/issue
   */
  async getIssue(req: Request, res: Response): Promise<void> {
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

      logInfo('Fetching Jira issue via MCP', { issueKey: trimmedKey });

      // Fetch issue from Jira via MCP
      const issueData = await this.jiraService.getIssue(trimmedKey);

      // Generate XML representation
      const xmlData = this.jiraService.generateXML(issueData);

      logInfo('Successfully fetched Jira issue', { issueKey: trimmedKey });

      res.status(200).json({
        success: true,
        data: issueData,
        xml: xmlData,
        message: 'Issue retrieved successfully',
      });
    } catch (error) {
      const issueKey = req.body?.issueKey || 'unknown';
      logError('Failed to fetch Jira issue', error, { issueKey });

      // Extract error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch issue';
      
      // Determine appropriate status code based on error type
      let statusCode = 500;
      
      if (errorMessage.includes('Invalid issue key format') ||
          errorMessage.includes('cannot be empty')) {
        statusCode = 400; // Bad Request
      } else if (errorMessage.includes('not found') ||
                 errorMessage.includes('does not exist')) {
        statusCode = 404; // Not Found
      } else if (errorMessage.includes('Access denied') ||
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

// Made with Bob
