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
        [key: string]: any;
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
export declare class MCPJiraClient {
    private config;
    private mcpProcess;
    private isConnected;
    constructor(config?: Partial<MCPConfig>);
    /**
     * Initialize MCP connection to Jira server
     */
    connect(): Promise<boolean>;
    /**
     * Disconnect from MCP server
     */
    disconnect(): Promise<void>;
    /**
     * Fetch Jira issue by key
     * @param issueKey - Jira issue key (e.g., "CSR-123")
     * @param fields - Comma-separated fields to retrieve
     * @returns Jira issue data
     */
    fetchIssue(issueKey: string, fields?: string): Promise<JiraIssue>;
    /**
     * Search Jira issues using JQL
     * @param jql - JQL query string
     * @param fields - Fields to retrieve
     * @param maxResults - Maximum number of results
     * @returns Array of Jira issues
     */
    searchIssues(jql: string, fields?: string, maxResults?: number): Promise<JiraIssue[]>;
    /**
     * Add comment to Jira issue
     * @param issueKey - Jira issue key
     * @param comment - Comment text (Markdown format)
     * @returns Comment ID
     */
    addComment(issueKey: string, comment: string): Promise<string>;
    /**
     * Update Jira issue fields
     * @param issueKey - Jira issue key
     * @param fields - Fields to update (JSON string)
     * @returns Updated issue
     */
    updateIssue(issueKey: string, fields: Record<string, any>): Promise<JiraIssue>;
    /**
     * Transform Jira issue to structured XML format
     * @param issue - Jira issue data
     * @returns XML string
     */
    transformToXML(issue: JiraIssue): string;
    /**
     * Call MCP tool via stdio
     */
    private callMCPTool;
    /**
     * Wait for MCP connection to establish
     */
    private waitForConnection;
}
export declare const mcpJiraClient: MCPJiraClient;
//# sourceMappingURL=jira-client.d.ts.map