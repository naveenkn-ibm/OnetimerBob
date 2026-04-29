import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { aiAnalysisService, IntentAnalysisResult, AnalysisProgress } from '../services/ai-analysis.service';
import { logInfo, logError } from '../utils/logger';

/**
 * AI Controller for Step 4
 * Handles AI-powered analysis endpoints
 */
export class AIController {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * POST /api/ai/analyze
   * Analyze CSR/Jira content and extract intent + entities
   */
  analyzeCSR = async (req: Request, res: Response): Promise<void> => {
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
      if (!aiAnalysisService.isAvailable()) {
        res.status(503).json({
          success: false,
          message: 'AI analysis service is not available. OpenAI API key may not be configured.',
          error: 'Service unavailable',
        });
        return;
      }

      logInfo('AI analysis request received', {
        issueKey: issueData.key,
        socketId,
      });

      // Progress callback to emit real-time updates via WebSocket
      const progressCallback = (progress: AnalysisProgress) => {
        if (socketId) {
          this.io.to(socketId).emit('ai:progress', progress);
        }
        logInfo('AI analysis progress', {
          step: progress.step,
          message: progress.message,
        });
      };

      // Perform AI analysis
      const result: IntentAnalysisResult = await aiAnalysisService.analyzeCSRContent(
        issueData,
        progressCallback
      );

      // Validate extraction
      const validation = aiAnalysisService.validateExtraction(result);

      logInfo('AI analysis completed', {
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
    } catch (error) {
      const issueKey = req.body?.issueData?.key || 'unknown';
      logError('AI analysis failed', error, { issueKey });

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
  reanalyze = async (req: Request, res: Response): Promise<void> => {
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
      if (!aiAnalysisService.isAvailable()) {
        res.status(503).json({
          success: false,
          message: 'AI analysis service is not available',
        });
        return;
      }

      logInfo('AI re-analysis request received', {
        issueKey: issueData.key,
        corrections,
      });

      // Progress callback
      const progressCallback = (progress: AnalysisProgress) => {
        if (socketId) {
          this.io.to(socketId).emit('ai:progress', progress);
        }
      };

      // Perform re-analysis
      const result = await aiAnalysisService.reanalyzeWithCorrections(
        issueData,
        corrections,
        progressCallback
      );

      // Validate extraction
      const validation = aiAnalysisService.validateExtraction(result);

      logInfo('AI re-analysis completed', {
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
    } catch (error) {
      logError('AI re-analysis failed', error);

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
  getStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const isAvailable = aiAnalysisService.isAvailable();

      res.status(200).json({
        success: true,
        available: isAvailable,
        message: isAvailable
          ? 'AI analysis service is available'
          : 'AI analysis service is not configured',
      });
    } catch (error) {
      logError('Failed to check AI service status', error);

      res.status(500).json({
        success: false,
        available: false,
        message: 'Failed to check service status',
      });
    }
  };
}

// Made with Bob