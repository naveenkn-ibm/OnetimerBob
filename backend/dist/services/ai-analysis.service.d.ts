/**
 * AI Analysis Service for Step 4
 * Specialized service for intent extraction and entity recognition
 * from CSR/Jira content for healthcare claims processing
 */
export interface IntentAnalysisResult {
    intent: string;
    region?: string;
    claims?: string[];
    entities: Record<string, any>;
    summary: string;
    confidence: number;
}
export interface AnalysisProgress {
    step: string;
    message: string;
    timestamp: string;
}
export declare class AIAnalysisService {
    private openAIService;
    constructor();
    /**
     * Check if AI service is available
     */
    isAvailable(): boolean;
    /**
     * Analyze CSR/Jira content and extract intent + entities
     * This is the core Step 4 functionality
     */
    analyzeCSRContent(issueData: any, progressCallback?: (progress: AnalysisProgress) => void): Promise<IntentAnalysisResult>;
    /**
     * Build comprehensive analysis prompt from Jira issue data
     */
    private buildAnalysisPrompt;
    /**
     * Emit progress update
     */
    private emitProgress;
    /**
     * Validate extracted entities
     * Returns validation results with suggestions for corrections
     */
    validateExtraction(result: IntentAnalysisResult): {
        valid: boolean;
        issues: string[];
        suggestions: string[];
    };
    /**
     * Re-analyze with user corrections
     * Allows user to provide feedback and re-run analysis
     */
    reanalyzeWithCorrections(issueData: any, corrections: {
        intent?: string;
        region?: string;
        claims?: string[];
        additionalContext?: string;
    }, progressCallback?: (progress: AnalysisProgress) => void): Promise<IntentAnalysisResult>;
}
export declare const aiAnalysisService: AIAnalysisService;
//# sourceMappingURL=ai-analysis.service.d.ts.map