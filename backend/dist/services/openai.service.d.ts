/**
 * OpenAI Service for AI-powered features in OneTimer Bob
 * Provides intelligent analysis, summarization, and assistance
 */
export declare class OpenAIService {
    private client;
    private model;
    private isConfigured;
    constructor();
    /**
     * Check if OpenAI is properly configured
     */
    isAvailable(): boolean;
    /**
     * Analyze Jira issue and extract key information
     */
    analyzeJiraIssue(issueData: any): Promise<{
        summary: string;
        intent: string;
        claimDetails: any;
        keyPoints: string[];
        recommendations: string[];
    }>;
    /**
     * Generate XML structure from Jira issue data
     */
    generateXMLFromJira(issueData: any): Promise<string>;
    /**
     * Generate task breakdown from requirements
     */
    generateTaskBreakdown(requirements: string): Promise<{
        tasks: Array<{
            id: string;
            title: string;
            description: string;
            priority: 'high' | 'medium' | 'low';
            estimatedTime: string;
            dependencies: string[];
        }>;
        workflow: string[];
    }>;
    /**
     * AI Agent for conversational assistance
     */
    agentChat(message: string, conversationHistory?: Array<{
        role: string;
        content: string;
    }>): Promise<{
        response: string;
        toolCalls: Array<{
            tool: string;
            params: any;
        }>;
        needsConfirmation: boolean;
    }>;
    /**
     * Explain mainframe output or logs
     */
    explainOutput(content: string, context?: string): Promise<{
        summary: string;
        status: 'success' | 'failure' | 'warning';
        keySteps: string[];
        errors: string[];
        recommendations: string[];
    }>;
    /**
     * Parse JSON response from OpenAI, handling markdown code blocks
     */
    private parseJSONResponse;
    /**
     * Handle OpenAI API errors
     */
    private handleOpenAIError;
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.service.d.ts.map