interface JiraIssueData {
    key: string;
    fields: {
        summary: string;
        description: string;
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
export declare class JiraService {
    private mcpClient;
    private isConnected;
    constructor();
    /**
     * Initialize MCP client connection to Atlassian server
     */
    private initializeMCP;
    /**
     * Validate Jira issue key format
     * Expected format: PROJECT-123 (e.g., BTP-2, PROJ-456, ABC-1234)
     */
    private validateIssueKey;
    /**
     * Fetch Jira issue using MCP tool
     */
    getIssue(issueKey: string): Promise<JiraIssueData>;
    /**
     * Transform raw Jira data to our format
     * Handles both standard Jira API format (nested fields) and MCP Atlassian format (flat structure)
     */
    private transformJiraData;
    /**
     * Generate XML representation of Jira issue
     */
    generateXML(issueData: JiraIssueData): string;
    /**
     * Close MCP connection
     */
    disconnect(): Promise<void>;
}
export {};
//# sourceMappingURL=jira.service.d.ts.map