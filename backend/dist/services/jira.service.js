"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraService = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const logger_1 = require("../utils/logger");
class JiraService {
    mcpClient = null;
    isConnected = false;
    constructor() {
        // MCP client will be initialized on first use
    }
    /**
     * Initialize MCP client connection to Atlassian server
     */
    async initializeMCP() {
        if (this.isConnected && this.mcpClient) {
            return;
        }
        try {
            (0, logger_1.logInfo)('Initializing MCP Atlassian client...');
            // Create MCP client
            this.mcpClient = new index_js_1.Client({
                name: 'onetimer-bob-jira-client',
                version: '1.0.0',
            }, {
                capabilities: {},
            });
            // Connect to MCP Atlassian server via stdio
            // Pass environment variables with their actual values
            const transport = new stdio_js_1.StdioClientTransport({
                command: 'podman',
                args: [
                    'run',
                    '-i',
                    '--rm',
                    '-e',
                    `JIRA_URL=${process.env.JIRA_URL}`,
                    '-e',
                    `JIRA_USERNAME=${process.env.JIRA_USERNAME}`,
                    '-e',
                    `JIRA_API_TOKEN=${process.env.JIRA_API_TOKEN}`,
                    'mcp-atlassian:latest',
                ],
            });
            await this.mcpClient.connect(transport);
            this.isConnected = true;
            (0, logger_1.logInfo)('MCP Atlassian client connected successfully');
        }
        catch (error) {
            (0, logger_1.logError)('Failed to initialize MCP client', error);
            throw new Error('Failed to connect to Jira via MCP');
        }
    }
    /**
     * Validate Jira issue key format
     * Expected format: PROJECT-123 (e.g., BTP-2, PROJ-456, ABC-1234)
     */
    validateIssueKey(issueKey) {
        // Trim whitespace
        const trimmedKey = issueKey.trim();
        // Check if empty
        if (!trimmedKey) {
            return {
                valid: false,
                error: 'Issue key cannot be empty. Please enter a valid Jira issue key (e.g., BTP-2, PROJ-123)'
            };
        }
        // Jira issue key pattern: PROJECT-NUMBER
        // PROJECT: 1+ uppercase letters, numbers, or underscores (must start with letter)
        // NUMBER: 1+ digits
        const issueKeyPattern = /^[A-Z][A-Z0-9_]+-\d+$/;
        if (!issueKeyPattern.test(trimmedKey)) {
            return {
                valid: false,
                error: `Invalid issue key format: "${trimmedKey}". Expected format: PROJECT-NUMBER (e.g., BTP-2, PROJ-123, ABC-1234)`
            };
        }
        return { valid: true };
    }
    /**
     * Fetch Jira issue using MCP tool
     */
    async getIssue(issueKey) {
        try {
            // Validate issue key format first
            const validation = this.validateIssueKey(issueKey);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            await this.initializeMCP();
            if (!this.mcpClient) {
                throw new Error('MCP client not initialized');
            }
            (0, logger_1.logInfo)('Fetching Jira issue via MCP', { issueKey });
            // Call MCP tool to get issue
            const result = await this.mcpClient.callTool({
                name: 'jira_get_issue',
                arguments: {
                    issue_key: issueKey.trim(),
                },
            });
            (0, logger_1.logDebug)('MCP tool response received', { result });
            // Parse the response
            if (!result.content || !Array.isArray(result.content) || result.content.length === 0) {
                throw new Error('No content returned from MCP tool');
            }
            // Extract text content from MCP response
            const textContent = result.content.find((c) => c.type === 'text');
            if (!textContent || !('text' in textContent)) {
                throw new Error('Invalid response format from MCP tool');
            }
            // Check if response is an error message
            const responseText = textContent.text;
            if (responseText.startsWith('Error')) {
                // Parse the error message to provide user-friendly feedback
                const errorMsg = responseText.toLowerCase();
                // Authentication/Authorization errors (403)
                if (errorMsg.includes('authentication failed') ||
                    errorMsg.includes('403') ||
                    errorMsg.includes('token may be expired') ||
                    errorMsg.includes('verify credentials')) {
                    throw new Error(`Jira authentication failed. Your Jira credentials may be expired or invalid. Please contact your administrator to verify your Jira access.`);
                }
                // Issue not found (404)
                if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                    throw new Error(`Issue "${issueKey}" not found in Jira. Please verify the issue key and try again.`);
                }
                // Permission denied (403 - different from auth failure)
                if (errorMsg.includes('permission') || errorMsg.includes('access denied')) {
                    throw new Error(`Access denied to issue "${issueKey}". You may not have permission to view this issue.`);
                }
                // Validation error (400)
                if (errorMsg.includes('validation error')) {
                    throw new Error(`Invalid issue key format: "${issueKey}". Expected format: PROJECT-NUMBER (e.g., BTP-2, PROJ-123)`);
                }
                // Generic error - include the actual error message
                throw new Error(`Failed to fetch issue "${issueKey}": ${responseText.replace('Error calling tool \'get_issue\': ', '')}`);
            }
            // Parse JSON response
            let issueData;
            try {
                issueData = JSON.parse(responseText);
            }
            catch (parseError) {
                (0, logger_1.logError)('Failed to parse MCP response as JSON', parseError, { responseText: responseText.substring(0, 200) });
                throw new Error(`Invalid response from Jira. The issue "${issueKey}" may not exist or the response format is unexpected.`);
            }
            // Validate that we got actual issue data
            if (!issueData || !issueData.key) {
                throw new Error(`Issue "${issueKey}" not found in Jira. Please verify the issue key exists.`);
            }
            // Fetch attachments for this issue
            try {
                (0, logger_1.logInfo)('Fetching attachments for issue', { issueKey });
                const attachmentResult = await this.mcpClient.callTool({
                    name: 'jira_download_attachments',
                    arguments: {
                        issue_key: issueKey.trim(),
                    },
                });
                // Parse attachment response
                if (attachmentResult.content && Array.isArray(attachmentResult.content)) {
                    const attachments = [];
                    // First item is the summary text, rest are embedded resources
                    for (let i = 1; i < attachmentResult.content.length; i++) {
                        const item = attachmentResult.content[i];
                        if (item.type === 'resource' && 'resource' in item) {
                            const resource = item.resource;
                            attachments.push({
                                id: resource.uri || `attachment-${i}`,
                                filename: resource.uri?.split('/').pop() || `attachment-${i}`,
                                size: resource.blob ? Buffer.from(resource.blob, 'base64').length : 0,
                                mimeType: resource.mimeType || 'application/octet-stream',
                                content: resource.blob || '',
                                created: new Date().toISOString(),
                            });
                        }
                    }
                    if (attachments.length > 0) {
                        (0, logger_1.logInfo)(`Found ${attachments.length} attachment(s)`, { issueKey });
                        issueData.attachment = attachments;
                    }
                }
            }
            catch (attachmentError) {
                // Log but don't fail the entire request if attachments fail
                (0, logger_1.logError)('Failed to fetch attachments', attachmentError, { issueKey });
            }
            (0, logger_1.logInfo)('Successfully fetched Jira issue', { issueKey });
            return this.transformJiraData(issueData);
        }
        catch (error) {
            (0, logger_1.logError)('Failed to fetch Jira issue via MCP', error, { issueKey });
            // Re-throw with user-friendly message if not already formatted
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Failed to fetch issue "${issueKey}". Please verify the issue exists and you have access to it.`);
        }
    }
    /**
     * Transform raw Jira data to our format
     * Handles both standard Jira API format (nested fields) and MCP Atlassian format (flat structure)
     */
    transformJiraData(rawData) {
        // Log the raw data structure for debugging
        (0, logger_1.logInfo)('Transforming Jira data', {
            hasKey: !!rawData.key,
            hasFields: !!rawData.fields,
            dataKeys: Object.keys(rawData || {}),
            fieldsKeys: rawData.fields ? Object.keys(rawData.fields) : []
        });
        // Log ALL available fields from MCP for verification
        (0, logger_1.logInfo)('📋 ALL AVAILABLE FIELDS FROM MCP:', {
            allFields: JSON.stringify(rawData, null, 2)
        });
        // Validate data structure
        if (!rawData || typeof rawData !== 'object') {
            throw new Error('Invalid Jira data: expected object');
        }
        if (!rawData.key) {
            throw new Error('Invalid Jira data: missing issue key');
        }
        // MCP Atlassian returns flat structure, standard Jira API returns nested fields
        const isMCPFormat = !rawData.fields && rawData.summary !== undefined;
        if (isMCPFormat) {
            (0, logger_1.logInfo)('Detected MCP Atlassian flat format, transforming to standard format');
        }
        // Extract fields from either format
        const fields = isMCPFormat ? rawData : rawData.fields;
        if (!fields || typeof fields !== 'object') {
            throw new Error('Invalid Jira data: missing or invalid fields');
        }
        // Extract and transform the fields we need
        const transformedFields = {
            summary: fields.summary || '',
            description: fields.description || '',
            status: {
                name: fields.status?.name || fields.status || 'Unknown',
            },
            issuetype: {
                name: fields.issuetype?.name || fields.issue_type?.name || fields.issue_type || 'Unknown',
            },
            priority: fields.priority
                ? (typeof fields.priority === 'string'
                    ? { name: fields.priority }
                    : { name: fields.priority.name })
                : undefined,
            assignee: fields.assignee
                ? (typeof fields.assignee === 'string'
                    ? { displayName: fields.assignee, emailAddress: '' }
                    : {
                        displayName: fields.assignee.display_name || fields.assignee.displayName || fields.assignee.name,
                        emailAddress: fields.assignee.email || fields.assignee.emailAddress || ''
                    })
                : undefined,
            reporter: fields.reporter
                ? (typeof fields.reporter === 'string'
                    ? { displayName: fields.reporter, emailAddress: '' }
                    : {
                        displayName: fields.reporter.display_name || fields.reporter.displayName || fields.reporter.name,
                        emailAddress: fields.reporter.email || fields.reporter.emailAddress || ''
                    })
                : undefined,
            created: fields.created,
            updated: fields.updated,
            labels: fields.labels || [],
        };
        // Preserve attachment data if present (added from rawData, not fields)
        if (rawData.attachment) {
            transformedFields.attachment = rawData.attachment;
        }
        // Add any additional fields that don't conflict with our transformed ones
        const excludeKeys = ['summary', 'description', 'status', 'issuetype', 'issue_type', 'priority', 'assignee', 'reporter', 'created', 'updated', 'labels', 'attachment'];
        Object.keys(fields).forEach(key => {
            if (!excludeKeys.includes(key)) {
                transformedFields[key] = fields[key];
            }
        });
        return {
            key: rawData.key,
            fields: transformedFields,
        };
    }
    /**
     * Generate XML representation of Jira issue
     */
    generateXML(issueData) {
        const escapeXml = (str) => {
            if (str === null || str === undefined) {
                return '';
            }
            // Convert to string if not already
            const strValue = typeof str === 'string' ? str : String(str);
            return strValue
                .replace(/&/g, '&')
                .replace(/</g, '<')
                .replace(/>/g, '>')
                .replace(/"/g, '"')
                .replace(/'/g, '\u0026apos;');
        };
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<jira-issue>
  <key>${escapeXml(issueData.key)}</key>
  <summary>${escapeXml(issueData.fields.summary)}</summary>
  <description>${escapeXml(issueData.fields.description || '')}</description>
  <issue-type>${escapeXml(issueData.fields.issuetype.name)}</issue-type>
  <status>${escapeXml(issueData.fields.status.name)}</status>
  ${issueData.fields.priority
            ? `<priority>${escapeXml(issueData.fields.priority.name)}</priority>`
            : ''}
  ${issueData.fields.assignee
            ? `<assignee>
    <name>${escapeXml(issueData.fields.assignee.displayName)}</name>
    <email>${escapeXml(issueData.fields.assignee.emailAddress)}</email>
  </assignee>`
            : ''}
  ${issueData.fields.reporter
            ? `<reporter>
    <name>${escapeXml(issueData.fields.reporter.displayName)}</name>
    <email>${escapeXml(issueData.fields.reporter.emailAddress)}</email>
  </reporter>`
            : ''}
  <created>${escapeXml(issueData.fields.created)}</created>
  <updated>${escapeXml(issueData.fields.updated)}</updated>
  ${issueData.fields.labels && issueData.fields.labels.length > 0
            ? `<labels>
${issueData.fields.labels.map((label) => `    <label>${escapeXml(label)}</label>`).join('\n')}
  </labels>`
            : ''}
</jira-issue>`;
        return xml;
    }
    /**
     * Close MCP connection
     */
    async disconnect() {
        if (this.mcpClient && this.isConnected) {
            try {
                await this.mcpClient.close();
                this.isConnected = false;
                (0, logger_1.logInfo)('MCP client disconnected');
            }
            catch (error) {
                (0, logger_1.logError)('Error disconnecting MCP client', error);
            }
        }
    }
}
exports.JiraService = JiraService;
// Made with Bob
//# sourceMappingURL=jira.service.js.map