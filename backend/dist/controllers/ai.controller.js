"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = void 0;
const ai_analysis_service_1 = require("../services/ai-analysis.service");
const logger_1 = require("../utils/logger");
/**
 * AI Controller for Step 4
 * Handles AI-powered analysis endpoints
 */
class AIController {
    io;
    constructor(io) {
        this.io = io;
    }
    /**
     * POST /api/ai/analyze
     * Analyze CSR/Jira content and extract intent + entities
     */
    analyzeCSR = async (req, res) => {
        try {
            const { issueData, socketId } = req.body;
            // Validate input
            if (!issueData) {
                res.status(400).json({
                    success: false,
                    message: 'Issue data is required for analysis',
                });
                return;
            }
            // Check if AI service is available
            if (!ai_analysis_service_1.aiAnalysisService.isAvailable()) {
                res.status(503).json({
                    success: false,
                    message: 'AI analysis service is not available. OpenAI API key may not be configured.',
                    error: 'Service unavailable',
                });
                return;
            }
            (0, logger_1.logInfo)('AI analysis request received', {
                issueKey: issueData.key,
                socketId,
            });
            // Progress callback to emit real-time updates via WebSocket
            const progressCallback = (progress) => {
                if (socketId) {
                    this.io.to(socketId).emit('ai:progress', progress);
                }
                (0, logger_1.logInfo)('AI analysis progress', {
                    step: progress.step,
                    message: progress.message,
                });
            };
            // Perform AI analysis
            const result = await ai_analysis_service_1.aiAnalysisService.analyzeCSRContent(issueData, progressCallback);
            // Validate extraction
            const validation = ai_analysis_service_1.aiAnalysisService.validateExtraction(result);
            (0, logger_1.logInfo)('AI analysis completed', {
                issueKey: issueData.key,
                intent: result.intent,
                confidence: result.confidence,
                valid: validation.valid,
            });
            // Send success response
            res.status(200).json({
                success: true,
                data: result,
                validation,
                message: 'Analysis completed successfully',
            });
        }
        catch (error) {
            const issueKey = req.body?.issueData?.key || 'unknown';
            (0, logger_1.logError)('AI analysis failed', error, { issueKey });
            const errorMessage = error instanceof Error ? error.message : 'Failed to analyze CSR content';
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: errorMessage,
                data: null,
            });
        }
    };
    /**
     * POST /api/ai/reanalyze
     * Re-analyze with user corrections
     */
    reanalyze = async (req, res) => {
        try {
            const { issueData, corrections, socketId } = req.body;
            // Validate input
            if (!issueData || !corrections) {
                res.status(400).json({
                    success: false,
                    message: 'Issue data and corrections are required',
                });
                return;
            }
            // Check if AI service is available
            if (!ai_analysis_service_1.aiAnalysisService.isAvailable()) {
                res.status(503).json({
                    success: false,
                    message: 'AI analysis service is not available',
                });
                return;
            }
            (0, logger_1.logInfo)('AI re-analysis request received', {
                issueKey: issueData.key,
                corrections,
            });
            // Progress callback
            const progressCallback = (progress) => {
                if (socketId) {
                    this.io.to(socketId).emit('ai:progress', progress);
                }
            };
            // Perform re-analysis
            const result = await ai_analysis_service_1.aiAnalysisService.reanalyzeWithCorrections(issueData, corrections, progressCallback);
            // Validate extraction
            const validation = ai_analysis_service_1.aiAnalysisService.validateExtraction(result);
            (0, logger_1.logInfo)('AI re-analysis completed', {
                issueKey: issueData.key,
                intent: result.intent,
                confidence: result.confidence,
            });
            res.status(200).json({
                success: true,
                data: result,
                validation,
                message: 'Re-analysis completed successfully',
            });
        }
        catch (error) {
            (0, logger_1.logError)('AI re-analysis failed', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to re-analyze content';
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: errorMessage,
            });
        }
    };
    /**
     * GET /api/ai/status
     * Check AI service availability
     */
    getStatus = async (_req, res) => {
        try {
            const isAvailable = ai_analysis_service_1.aiAnalysisService.isAvailable();
            res.status(200).json({
                success: true,
                available: isAvailable,
                message: isAvailable
                    ? 'AI analysis service is available'
                    : 'AI analysis service is not configured',
            });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to check AI service status', error);
            res.status(500).json({
                success: false,
                available: false,
                message: 'Failed to check service status',
            });
        }
    };
}
exports.AIController = AIController;
// Made with Bob
//# sourceMappingURL=ai.controller.js.map