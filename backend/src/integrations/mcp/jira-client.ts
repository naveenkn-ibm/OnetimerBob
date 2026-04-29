import { spawn, ChildProcess } from 'child_process';
import { logJira, logError, logInfo } from '../../utils/logger';

/**
 * MCP Jira Client for OneTimer Bob
 * Integrates with mcp-atlassian server via Model Context Protocol
 * Handles Jira issue retrieval, updates, and comment management
 */

export interface MCPConfig {
  jiraUrl: string;
  jiraUsername: string;
  jiraApiToken: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    reporter?: {
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    labels?: string[];
    [key: string]: any; // Custom fields
  };
}

export interface MCPToolCall {
  tool: string;
  arguments: Record<string, any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class MCPJiraClient {
  private config: MCPConfig;
  private mcpProcess: ChildProcess | null = null;
  private isConnected: boolean = false;

  constructor(config?: Partial<MCPConfig>) {
    this.config = {
      jiraUrl: config?.jiraUrl || process.env.JIRA_URL || '',
      jiraUsername: config?.jiraUsername || process.env.JIRA_USERNAME || '',
      jiraApiToken: config?.jiraApiToken || process.env.JIRA_API_TOKEN || '',
    };

    if (!this.config.jiraUrl || !this.config.jiraUsername || !this.config.jiraApiToken) {
      logError('MCP Jira configuration incomplete', undefined, {
        hasUrl: !!this.config.jiraUrl,
        hasUsername: !!this.config.jiraUsername,
        hasToken: !!this.config.jiraApiToken,
      });
    }
  }

  /**
   * Initialize MCP connection to Jira server
   */
  async connect(): Promise<boolean> {
    try {
      logInfo('Initializing MCP Jira connection');

      // Spawn the MCP Atlassian server using podman
      this.mcpProcess = spawn('podman', [
        'run',
        '-i',
        '--rm',
        '-e', `JIRA_URL=${this.config.jiraUrl}`,
        '-e', `JIRA_USERNAME=${this.config.jiraUsername}`,
        '-e', `JIRA_API_TOKEN=${this.config.jiraApiToken}`,
        'mcp-atlassian:latest'
      ]);

      // Handle process events
      this.mcpProcess.on('error', (error) => {
        logError('MCP process error', error);
        this.isConnected = false;
      });

      this.mcpProcess.on('exit', (code) => {
        logInfo('MCP process exited', { code });
        this.isConnected = false;
      });

      // Wait for connection to establish
      await this.waitForConnection();

      this.isConnected = true;
      logInfo('MCP Jira connection established');
      return true;
    } catch (error) {
      logError('Failed to connect to MCP Jira server', error);
      return false;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isConnected = false;
      logInfo('MCP Jira connection closed');
    }
  }

  /**
   * Fetch Jira issue by key
   * @param issueKey - Jira issue key (e.g., "CSR-123")
   * @param fields - Comma-separated fields to retrieve
   * @returns Jira issue data
   */
  async fetchIssue(issueKey: string, fields?: string): Promise<JiraIssue> {
    try {
      logJira('Fetching issue', issueKey);

      if (!this.isConnected) {
        await this.connect();
      }

      const response = await this.callMCPTool('jira_get_issue', {
        issue_key: issueKey,
        fields: fields || 'summary,description,status,issuetype,priority,assignee,reporter,created,updated,labels,customfield_*',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch issue');
      }

      logJira('Issue fetched successfully', issueKey);
      return response.data;
    } catch (error) {
      logError('Failed to fetch Jira issue', error, { issueKey });
      throw error;
    }
  }

  /**
   * Search Jira issues using JQL
   * @param jql - JQL query string
   * @param fields - Fields to retrieve
   * @param maxResults - Maximum number of results
   * @returns Array of Jira issues
   */
  async searchIssues(jql: string, fields?: string, maxResults: number = 50): Promise<JiraIssue[]> {
    try {
      logJira('Searching issues', 'SEARCH', { jql });

      if (!this.isConnected) {
        await this.connect();
      }

      const response = await this.callMCPTool('jira_search', {
        jql,
        fields: fields || 'summary,description,status,issuetype,priority',
        limit: maxResults,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to search issues');
      }

      logJira('Search completed', 'SEARCH', { count: response.data.length });
      return response.data;
    } catch (error) {
      logError('Failed to search Jira issues', error, { jql });
      throw error;
    }
  }

  /**
   * Add comment to Jira issue
   * @param issueKey - Jira issue key
   * @param comment - Comment text (Markdown format)
   * @returns Comment ID
   */
  async addComment(issueKey: string, comment: string): Promise<string> {
    try {
      logJira('Adding comment', issueKey);

      if (!this.isConnected) {
        await this.connect();
      }

      const response = await this.callMCPTool('jira_add_comment', {
        issue_key: issueKey,
        body: comment,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to add comment');
      }

      logJira('Comment added successfully', issueKey);
      return response.data.id;
    } catch (error) {
      logError('Failed to add Jira comment', error, { issueKey });
      throw error;
    }
  }

  /**
   * Update Jira issue fields
   * @param issueKey - Jira issue key
   * @param fields - Fields to update (JSON string)
   * @returns Updated issue
   */
  async updateIssue(issueKey: string, fields: Record<string, any>): Promise<JiraIssue> {
    try {
      logJira('Updating issue', issueKey, { fields: Object.keys(fields) });

      if (!this.isConnected) {
        await this.connect();
      }

      const response = await this.callMCPTool('jira_update_issue', {
        issue_key: issueKey,
        fields: JSON.stringify(fields),
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update issue');
      }

      logJira('Issue updated successfully', issueKey);
      return response.data;
    } catch (error) {
      logError('Failed to update Jira issue', error, { issueKey });
      throw error;
    }
  }

  /**
   * Transform Jira issue to structured XML format
   * @param issue - Jira issue data
   * @returns XML string
   */
  transformToXML(issue: JiraIssue): string {
    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '\u0026apos;');
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<requirement>\n';
    xml += `  <csr>${escapeXml(issue.key)}</csr>\n`;
    xml += `  <summary>${escapeXml(issue.fields.summary)}</summary>\n`;
    
    if (issue.fields.description) {
      xml += `  <description><![CDATA[${issue.fields.description}]]></description>\n`;
    }
    
    xml += `  <status>${escapeXml(issue.fields.status.name)}</status>\n`;
    xml += `  <type>${escapeXml(issue.fields.issuetype.name)}</type>\n`;
    
    if (issue.fields.priority) {
      xml += `  <priority>${escapeXml(issue.fields.priority.name)}</priority>\n`;
    }
    
    if (issue.fields.assignee) {
      xml += `  <assignee>\n`;
      xml += `    <name>${escapeXml(issue.fields.assignee.displayName)}</name>\n`;
      xml += `    <email>${escapeXml(issue.fields.assignee.emailAddress)}</email>\n`;
      xml += `  </assignee>\n`;
    }
    
    if (issue.fields.labels && issue.fields.labels.length > 0) {
      xml += `  <labels>\n`;
      issue.fields.labels.forEach(label => {
        xml += `    <label>${escapeXml(label)}</label>\n`;
      });
      xml += `  </labels>\n`;
    }
    
    // Extract custom fields (claim details for healthcare)
    const customFields = Object.keys(issue.fields).filter(key => key.startsWith('customfield_'));
    if (customFields.length > 0) {
      xml += `  <customFields>\n`;
      customFields.forEach(field => {
        const value = issue.fields[field];
        if (value !== null && value !== undefined) {
          xml += `    <field name="${escapeXml(field)}">${escapeXml(String(value))}</field>\n`;
        }
      });
      xml += `  </customFields>\n`;
    }
    
    xml += `  <created>${escapeXml(issue.fields.created)}</created>\n`;
    xml += `  <updated>${escapeXml(issue.fields.updated)}</updated>\n`;
    xml += '</requirement>';
    
    return xml;
  }

  /**
   * Call MCP tool via stdio
   */
  private async callMCPTool(tool: string, args: Record<string, any>): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess || !this.isConnected) {
        reject(new Error('MCP not connected'));
        return;
      }

      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool,
          arguments: args,
        },
      });

      let responseData = '';

      const dataHandler = (data: Buffer) => {
        responseData += data.toString();
        
        try {
          const response = JSON.parse(responseData);
          
          if (response.error) {
            this.mcpProcess?.stdout?.removeListener('data', dataHandler);
            resolve({
              success: false,
              error: response.error.message || 'MCP tool call failed',
            });
          } else {
            this.mcpProcess?.stdout?.removeListener('data', dataHandler);
            resolve({
              success: true,
              data: response.result,
            });
          }
        } catch (e) {
          // Incomplete JSON, wait for more data
        }
      };

      this.mcpProcess.stdout?.on('data', dataHandler);

      // Send request
      this.mcpProcess.stdin?.write(request + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        this.mcpProcess?.stdout?.removeListener('data', dataHandler);
        reject(new Error('MCP tool call timeout'));
      }, 30000);
    });
  }

  /**
   * Wait for MCP connection to establish
   */
  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP connection timeout'));
      }, 10000);

      // In a real implementation, we would wait for a ready signal from MCP
      // For now, we'll just wait a short time
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 2000);
    });
  }
}

// Export singleton instance
export const mcpJiraClient = new MCPJiraClient();

// Made with Bob
