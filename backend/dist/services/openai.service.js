"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAIService = exports.OpenAIService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
/**
 * OpenAI Service for AI-powered features in OneTimer Bob
 * Provides intelligent analysis, summarization, and assistance
 */
class OpenAIService {
    client;
    model;
    isConfigured;
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            (0, logger_1.logWarn)('OpenAI API key not configured. AI features will be disabled.');
            this.isConfigured = false;
            this.client = null;
            this.model = 'gpt-4o-mini';
            return;
        }
        this.client = new openai_1.default({ apiKey });
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        this.isConfigured = true;
        (0, logger_1.logInfo)(`OpenAI service initialized with model: ${this.model}`);
    }
    /**
     * Check if OpenAI is properly configured
     */
    isAvailable() {
        return this.isConfigured;
    }
    /**
     * Analyze Jira issue and extract key information
     */
    async analyzeJiraIssue(issueData) {
        if (!this.isConfigured) {
            throw new Error('OpenAI API key not configured');
        }
        const systemPrompt = `You are an expert healthcare claims processing analyst with deep knowledge of CSR (Customer Service Request) analysis.

Analyze the provided Jira issue and extract:
1. A concise summary of the issue
2. The user's intent (what they want to accomplish)
3. Claim details (ICN, member info, provider info, etc.)
4. Key points that need attention
5. Recommendations for processing

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "Brief 2-3 sentence summary",
  "intent": "What the user wants to accomplish",
  "claimDetails": {
    "icn": "Claim ICN if mentioned",
    "memberId": "Member ID if mentioned",
    "providerId": "Provider ID if mentioned",
    "claimAmount": "Claim amount if mentioned",
    "serviceDate": "Service date if mentioned",
    "other": {}
  },
  "keyPoints": ["Point 1", "Point 2", ...],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...]
}`;
        const userPrompt = `Analyze this Jira issue:

Key: ${issueData.key}
Type: ${issueData.fields.issuetype.name}
Summary: ${issueData.fields.summary}
Description: ${issueData.fields.description || 'No description provided'}
Status: ${issueData.fields.status.name}
Priority: ${issueData.fields.priority?.name || 'Not set'}
Labels: ${issueData.fields.labels?.join(', ') || 'None'}

Extract the intent and claim details from this issue.`;
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: this.model,
                temperature: 0.3,
                max_tokens: 2000,
            });
            const response = completion.choices[0]?.message?.content || '';
            return this.parseJSONResponse(response);
        }
        catch (error) {
            (0, logger_1.logError)('OpenAI analysis failed', error);
            throw this.handleOpenAIError(error);
        }
    }
    /**
     * Generate XML structure from Jira issue data
     */
    async generateXMLFromJira(issueData) {
        if (!this.isConfigured) {
            throw new Error('OpenAI API key not configured');
        }
        const systemPrompt = `You are an expert at converting Jira issues into structured XML format for healthcare claims processing.

Create a well-structured XML document that captures all relevant information from the Jira issue.

The XML should include:
- Issue metadata (key, type, status, priority)
- Summary and description
- Claim details if present
- Requirements and acceptance criteria
- Any custom fields

Use proper XML formatting with clear hierarchy and meaningful tag names.`;
        const userPrompt = `Convert this Jira issue to XML:

${JSON.stringify(issueData, null, 2)}

Generate a clean, well-structured XML document.`;
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: this.model,
                temperature: 0.2,
                max_tokens: 3000,
            });
            let response = completion.choices[0]?.message?.content || '';
            // Extract XML from markdown code blocks if present
            const xmlMatch = response.match(/```xml\s*([\s\S]*?)\s*```/) ||
                response.match(/```\s*([\s\S]*?)\s*```/);
            if (xmlMatch) {
                response = xmlMatch[1];
            }
            return response.trim();
        }
        catch (error) {
            (0, logger_1.logError)('XML generation failed', error);
            throw this.handleOpenAIError(error);
        }
    }
    /**
     * Generate task breakdown from requirements
     */
    async generateTaskBreakdown(requirements) {
        if (!this.isConfigured) {
            throw new Error('OpenAI API key not configured');
        }
        const systemPrompt = `You are an expert project manager specializing in healthcare claims processing workflows.

Analyze requirements and break them down into actionable tasks with:
1. Clear task titles and descriptions
2. Priority levels (high/medium/low)
3. Estimated time for completion
4. Task dependencies
5. Logical workflow sequence

Respond ONLY with valid JSON in this exact structure:
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "estimatedTime": "30 minutes",
      "dependencies": ["task-id-1", "task-id-2"]
    }
  ],
  "workflow": ["task-1", "task-2", "task-3"]
}`;
        const userPrompt = `Break down these requirements into tasks:

${requirements}

Create a logical task breakdown with workflow sequence.`;
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: this.model,
                temperature: 0.4,
                max_tokens: 3000,
            });
            const response = completion.choices[0]?.message?.content || '';
            return this.parseJSONResponse(response);
        }
        catch (error) {
            (0, logger_1.logError)('Task breakdown generation failed', error);
            throw this.handleOpenAIError(error);
        }
    }
    /**
     * AI Agent for conversational assistance
     */
    async agentChat(message, conversationHistory = []) {
        if (!this.isConfigured) {
            throw new Error('OpenAI API key not configured');
        }
        const systemPrompt = `You are Bob, an AI-powered assistant for healthcare claims processing and mainframe operations.

YOUR CAPABILITIES:
- Understand user intent and break down complex requests
- Analyze Jira issues and extract claim details
- Generate task breakdowns and workflows
- Provide intelligent recommendations
- Execute multi-step operations

AVAILABLE TOOLS:
- analyzeJiraIssue: Analyze a Jira issue and extract key information
- generateTaskBreakdown: Break down requirements into actionable tasks
- generateXML: Convert data to structured XML format

RULES:
1. Always understand the user's intent first
2. For complex requests, break them into steps
3. Call appropriate tools when needed
4. Explain what you're doing while executing
5. Never hallucinate results - only use actual data
6. For destructive actions, ALWAYS ask for confirmation
7. Be conversational and helpful
8. If unsure or missing information, ask for clarification

RESPONSE FORMAT:
When you need to use a tool, respond with:
TOOL_CALL: toolName(param1="value1", param2="value2")

For confirmation requests, include:
NEEDS_CONFIRMATION: true`;
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
        ];
        try {
            const completion = await this.client.chat.completions.create({
                messages: messages,
                model: this.model,
                temperature: 0.3,
                max_tokens: 2000,
            });
            const response = completion.choices[0]?.message?.content || '';
            // Parse tool calls
            const toolCallRegex = /TOOL_CALL:\s*(\w+)\((.*?)\)/g;
            const toolCalls = [];
            let match;
            while ((match = toolCallRegex.exec(response)) !== null) {
                const toolName = match[1];
                const paramsStr = match[2];
                const params = {};
                const paramRegex = /(\w+)="([^"]*)"/g;
                let paramMatch;
                while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
                    params[paramMatch[1]] = paramMatch[2];
                }
                toolCalls.push({ tool: toolName, params });
            }
            // Check for confirmation needs
            const needsConfirmation = response.includes('NEEDS_CONFIRMATION: true');
            // Remove tool call syntax from response
            const cleanResponse = response
                .replace(/TOOL_CALL:.*?\n/g, '')
                .replace(/NEEDS_CONFIRMATION:.*?\n/g, '')
                .trim();
            return {
                response: cleanResponse,
                toolCalls,
                needsConfirmation,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Agent chat failed', error);
            throw this.handleOpenAIError(error);
        }
    }
    /**
     * Explain mainframe output or logs
     */
    async explainOutput(content, context) {
        if (!this.isConfigured) {
            throw new Error('OpenAI API key not configured');
        }
        const systemPrompt = `You are an expert IBM mainframe engineer with deep knowledge of z/OS, JCL, and system logs.

Analyze output/logs and provide structured explanations in JSON format.

Your response MUST be valid JSON with this exact structure:
{
  "summary": "Brief 2-3 sentence overview",
  "status": "success" or "failure" or "warning",
  "keySteps": ["Step 1 description", "Step 2 description"],
  "errors": ["Error 1 if any", "Error 2 if any"],
  "recommendations": ["Recommendation 1 if needed", "Recommendation 2 if needed"]
}

Guidelines:
1. Explain in simple terms for non-experts
2. Identify if the operation succeeded, failed, or has warnings
3. List key execution steps
4. Highlight any errors or warnings
5. Provide actionable recommendations if something failed
6. Keep explanations concise and clear
7. Respond ONLY with valid JSON, no additional text`;
        const userPrompt = context
            ? `Context: ${context}\n\nAnalyze this output:\n\n${content}`
            : `Analyze this output:\n\n${content}`;
        try {
            const completion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: this.model,
                temperature: 0.3,
                max_tokens: 2000,
            });
            const response = completion.choices[0]?.message?.content || '';
            return this.parseJSONResponse(response);
        }
        catch (error) {
            (0, logger_1.logError)('Output explanation failed', error);
            throw this.handleOpenAIError(error);
        }
    }
    /**
     * Parse JSON response from OpenAI, handling markdown code blocks
     */
    parseJSONResponse(response) {
        try {
            return JSON.parse(response);
        }
        catch (parseError) {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                response.match(/```\s*([\s\S]*?)\s*```/) ||
                response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
                }
                catch (e) {
                    throw new Error('Could not parse AI response as JSON');
                }
            }
            else {
                throw new Error('No JSON found in AI response');
            }
        }
    }
    /**
     * Handle OpenAI API errors
     */
    handleOpenAIError(error) {
        let errorMessage = 'Failed to process AI request';
        let errorDetails = error.message;
        if (error.message?.includes('API key') || error.message?.includes('Incorrect API key')) {
            errorMessage = 'OpenAI API key not configured or invalid';
            errorDetails =
                'Please set OPENAI_API_KEY environment variable. Get your key at https://platform.openai.com/api-keys';
        }
        else if (error.response) {
            errorMessage = `OpenAI API error: ${error.response.status}`;
            errorDetails = error.response.data?.error?.message || error.response.statusText;
        }
        else if (error.request) {
            errorMessage = 'No response from OpenAI API';
            errorDetails = 'Check your internet connection';
        }
        else if (error.message?.includes('quota')) {
            errorMessage = 'OpenAI API quota exceeded';
            errorDetails = 'Please check your OpenAI account billing and usage limits';
        }
        else if (error.message?.includes('rate limit')) {
            errorMessage = 'OpenAI API rate limit exceeded';
            errorDetails = 'Too many requests. Please wait a moment and try again';
        }
        const err = new Error(errorMessage);
        err.details = errorDetails;
        return err;
    }
}
exports.OpenAIService = OpenAIService;
// Export singleton instance
exports.openAIService = new OpenAIService();
// Made with Bob
//# sourceMappingURL=openai.service.js.map