import { OpenAIService } from './openai.service';
import { logInfo, logError } from '../utils/logger';

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

export class AIAnalysisService {
  private openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  /**
   * Check if AI service is available
   */
  public isAvailable(): boolean {
    return this.openAIService.isAvailable();
  }

  /**
   * Analyze CSR/Jira content and extract intent + entities
   * This is the core Step 4 functionality
   */
  public async analyzeCSRContent(
    issueData: any,
    progressCallback?: (progress: AnalysisProgress) => void
  ): Promise<IntentAnalysisResult> {
    if (!this.openAIService.isAvailable()) {
      throw new Error('OpenAI API key not configured. AI analysis is unavailable.');
    }

    try {
      // Progress: Starting analysis
      this.emitProgress(progressCallback, 'init', 'Sending CSR content to AI engine…');

      logInfo('Starting AI analysis for CSR content', {
        issueKey: issueData.key,
        issueType: issueData.fields?.issuetype?.name,
      });

      // Progress: Analyzing intent
      this.emitProgress(progressCallback, 'analyzing', 'Analyzing intent and extracting entities…');

      const systemPrompt = `You are an expert healthcare claims processing analyst specializing in CSR (Customer Service Request) analysis.

Your task is to analyze CSR/Jira content and extract:
1. **Intent**: The primary action the user wants to perform (e.g., "Delete Claims", "Update Claim Status", "Process Refund", "Investigate Claim")
2. **Region**: The environment/region mentioned (e.g., "Production", "Test", "UAT", "Development")
3. **Claims**: List of claim numbers/ICNs mentioned in the content
4. **Entities**: Any other relevant structured data (member IDs, provider IDs, dates, amounts, etc.)
5. **Summary**: A clear, concise explanation of what the user is requesting

CRITICAL RULES:
1. Extract claim numbers in their EXACT format as they appear (e.g., "20265678248200,710")
2. Identify the region/environment explicitly mentioned
3. Be precise with intent classification
4. Return confidence score (0-100) based on clarity of the request
5. If information is ambiguous, note it in the summary

Respond ONLY with valid JSON in this exact structure:
{
  "intent": "Primary action requested (e.g., Delete Claims, Update Status)",
  "region": "Environment name (Production, Test, etc.) or null if not mentioned",
  "claims": ["claim1", "claim2", ...] or null if no claims mentioned,
  "entities": {
    "memberId": "value or null",
    "providerId": "value or null",
    "serviceDate": "value or null",
    "claimAmount": "value or null",
    "other": {}
  },
  "summary": "Clear explanation of the request in 2-3 sentences",
  "confidence": 85
}`;

      const userPrompt = this.buildAnalysisPrompt(issueData);

      // Call OpenAI
      const response = await this.openAIService['client'].chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: this.openAIService['model'],
        temperature: 0.2, // Low temperature for precise extraction
        max_tokens: 2000,
        response_format: { type: 'json_object' }, // Ensure JSON response
      });

      // Progress: Structuring response
      this.emitProgress(progressCallback, 'structuring', 'Structuring response…');

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);

      // Validate and normalize result
      const normalizedResult: IntentAnalysisResult = {
        intent: result.intent || 'Unknown Intent',
        region: result.region || undefined,
        claims: result.claims || undefined,
        entities: result.entities || {},
        summary: result.summary || 'Unable to generate summary',
        confidence: result.confidence || 0,
      };

      // Progress: Complete
      this.emitProgress(progressCallback, 'complete', 'Extraction complete. Ready for review.');

      logInfo('AI analysis completed successfully', {
        issueKey: issueData.key,
        intent: normalizedResult.intent,
        confidence: normalizedResult.confidence,
      });

      return normalizedResult;
    } catch (error) {
      logError('AI analysis failed', error, { issueKey: issueData.key });
      throw new Error(
        `Failed to analyze CSR content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build comprehensive analysis prompt from Jira issue data
   */
  private buildAnalysisPrompt(issueData: any): string {
    const fields = issueData.fields || {};
    
    let prompt = `Analyze this CSR/Jira issue and extract intent and entities:\n\n`;
    
    prompt += `**Issue Key**: ${issueData.key}\n`;
    prompt += `**Type**: ${fields.issuetype?.name || 'Unknown'}\n`;
    prompt += `**Summary**: ${fields.summary || 'No summary'}\n\n`;
    
    if (fields.description) {
      prompt += `**Description**:\n${fields.description}\n\n`;
    }
    
    if (fields.status) {
      prompt += `**Status**: ${fields.status.name}\n`;
    }
    
    if (fields.priority) {
      prompt += `**Priority**: ${fields.priority.name}\n`;
    }
    
    if (fields.labels && fields.labels.length > 0) {
      prompt += `**Labels**: ${fields.labels.join(', ')}\n`;
    }
    
    // Include custom fields if present
    const customFields = Object.keys(fields).filter(key => key.startsWith('customfield_'));
    if (customFields.length > 0) {
      prompt += `\n**Additional Fields**:\n`;
      customFields.forEach(field => {
        const value = fields[field];
        if (value && typeof value === 'string') {
          prompt += `- ${field}: ${value}\n`;
        }
      });
    }
    
    prompt += `\n**Task**: Extract the intent, region, claim numbers, and any other relevant entities from this content.`;
    
    return prompt;
  }

  /**
   * Emit progress update
   */
  private emitProgress(
    callback: ((progress: AnalysisProgress) => void) | undefined,
    step: string,
    message: string
  ): void {
    if (callback) {
      callback({
        step,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Validate extracted entities
   * Returns validation results with suggestions for corrections
   */
  public validateExtraction(result: IntentAnalysisResult): {
    valid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check confidence level
    if (result.confidence < 50) {
      issues.push('Low confidence in extraction results');
      suggestions.push('Review the extracted data carefully and make corrections if needed');
    }

    // Check if intent is meaningful
    if (!result.intent || result.intent === 'Unknown Intent') {
      issues.push('Intent could not be determined');
      suggestions.push('Provide more context in the CSR description');
    }

    // Check if claims are in valid format (if present)
    if (result.claims && result.claims.length > 0) {
      result.claims.forEach((claim, index) => {
        if (!claim || typeof claim !== 'string' || claim.trim().length === 0) {
          issues.push(`Claim ${index + 1} is empty or invalid`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Re-analyze with user corrections
   * Allows user to provide feedback and re-run analysis
   */
  public async reanalyzeWithCorrections(
    issueData: any,
    corrections: {
      intent?: string;
      region?: string;
      claims?: string[];
      additionalContext?: string;
    },
    progressCallback?: (progress: AnalysisProgress) => void
  ): Promise<IntentAnalysisResult> {
    if (!this.openAIService.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    this.emitProgress(progressCallback, 'reanalyzing', 'Re-analyzing with your corrections…');

    const systemPrompt = `You are re-analyzing a CSR with user-provided corrections. 
    
Use the corrections as authoritative information and refine the analysis accordingly.

Respond with the same JSON structure as before, incorporating the corrections.`;

    const userPrompt = `${this.buildAnalysisPrompt(issueData)}

**User Corrections**:
${corrections.intent ? `- Corrected Intent: ${corrections.intent}` : ''}
${corrections.region ? `- Corrected Region: ${corrections.region}` : ''}
${corrections.claims ? `- Corrected Claims: ${corrections.claims.join(', ')}` : ''}
${corrections.additionalContext ? `- Additional Context: ${corrections.additionalContext}` : ''}

Re-analyze with these corrections in mind.`;

    try {
      const response = await this.openAIService['client'].chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: this.openAIService['model'],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);

      this.emitProgress(progressCallback, 'complete', 'Re-analysis complete.');

      return {
        intent: result.intent || corrections.intent || 'Unknown Intent',
        region: result.region || corrections.region,
        claims: result.claims || corrections.claims,
        entities: result.entities || {},
        summary: result.summary || 'Re-analyzed with user corrections',
        confidence: result.confidence || 100, // High confidence with user corrections
      };
    } catch (error) {
      logError('Re-analysis failed', error);
      throw new Error('Failed to re-analyze with corrections');
    }
  }
}

// Export singleton instance
export const aiAnalysisService = new AIAnalysisService();

// Made with Bob