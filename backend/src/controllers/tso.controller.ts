import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AuthService } from '@services/auth.service.simple';
import {
  tsoExecutionService,
  WorkflowStepName,
  TSOStepAwaitingApprovalEvent,
  TSOStepErrorAnalysisEvent,
  TSOJclPreviewEvent,
  TSOJobSubmittedEvent,
} from '@services/tso-execution.service';
import { logError, logInfo } from '@utils/logger';

interface ExecuteTSORequest {
  issueKey: string;
  socketId?: string;
  workflowSteps?: WorkflowStepName[];
  analysis: {
    intent: string;
    region?: string;
    claims?: string[];
    summary?: string;
  };
}

export class TSOController {
  private io: SocketIOServer;
  private authService: AuthService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.authService = new AuthService();
  }

  /** Delegate step approval to the execution service */
  approveStep(socketId: string, editedJcl?: string): void {
    tsoExecutionService.approveStep(socketId, editedJcl);
  }

  executeTSO = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const body = req.body as ExecuteTSORequest;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'Authorization token is required',
        });
        return;
      }

      if (!body.issueKey || !body.analysis?.intent) {
        res.status(400).json({
          success: false,
          message: 'issueKey and analysis intent are required',
        });
        return;
      }

      const validation = await this.authService.validateToken(token);
      if (!validation.valid || !validation.tsoId) {
        res.status(401).json({
          success: false,
          message: 'Invalid session token',
        });
        return;
      }

      const ltpaToken = AuthService.getMainframeToken(validation.tsoId);
      if (!ltpaToken) {
        res.status(401).json({
          success: false,
          message: 'Mainframe session not found. Please login again.',
        });
        return;
      }

      const emitProgress = (event: { step: string; message: string; status: 'pending' | 'in-progress' | 'completed' | 'error' }) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:progress', event);
        }
      };

      const emitOutput = (output: { jobId: string; lines: string[]; outputClass?: string }) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:output', output);
        }
      };

      const emitComplete = (completion: { jobId: string; returnCode: number; summary: string }) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:complete', completion);
        }
      };

      const emitStepAwaiting = (event: TSOStepAwaitingApprovalEvent) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:step-awaiting-approval', event);
        }
      };

      const emitStepErrorAnalysis = (event: TSOStepErrorAnalysisEvent) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:step-error-analysis', event);
        }
      };

      const emitJclPreview = (event: TSOJclPreviewEvent) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:jcl-preview', event);
        }
      };

      const emitJobSubmitted = (event: TSOJobSubmittedEvent) => {
        if (body.socketId) {
          this.io.to(body.socketId).emit('tso:job-submitted', event);
        }
      };

      // Respond immediately — the full workflow runs in the background.
      // All progress, JCL preview, job submission, and completion events are
      // delivered to the client via Socket.IO, so the HTTP connection doesn't
      // need to stay open for the duration of the workflow.
      res.status(202).json({
        success: true,
        message: 'Workflow started',
      });

      tsoExecutionService.executeInBackground(
        {
          issueKey: body.issueKey,
          socketId: body.socketId,
          workflowSteps: body.workflowSteps,
          analysis: body.analysis,
        },
        ltpaToken,
        emitProgress,
        emitOutput,
        emitComplete,
        emitStepAwaiting,
        emitStepErrorAnalysis,
        emitJclPreview,
        emitJobSubmitted,
      ).then((submission) => {
        logInfo('TSO execution completed', {
          issueKey: body.issueKey,
          jobId: submission.jobId,
          user: validation.tsoId,
        });
      }).catch((error: unknown) => {
        logError('TSO background execution failed', error instanceof Error ? error : new Error(String(error)));
      });
    } catch (error) {
      logError('TSO execution failed', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to execute TSO job',
      });
    }
  };

  getJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      
      // Try to get from cache first
      const record = tsoExecutionService.getJob(jobId);

      if (record) {
        res.status(200).json({
          success: true,
          data: {
            jobId: record.jobId,
            jobName: record.jobName,
            owner: record.owner,
            status: record.lifecycleStatus,
            returnCode: record.returnCode,
            stepInfo: record.stepInfo,
            spoolFiles: record.spoolFiles,
            updatedAt: record.updatedAt,
          },
        });
        return;
      }

      // If not in cache and we have auth, try fetching from z/OSMF
      if (token) {
        logInfo(`Attempting to fetch job ${jobId} from z/OSMF (not in cache)`);
        const validation = await this.authService.validateToken(token);
        if (validation.valid && validation.tsoId) {
          logInfo(`Token validated for user ${validation.tsoId}`);
          const ltpaToken = AuthService.getMainframeToken(validation.tsoId);
          if (ltpaToken) {
            logInfo(`LTPA token found, fetching from z/OSMF`);
            try {
              const zosmfData = await tsoExecutionService.fetchJobFromZOSMF(jobId, ltpaToken);
              logInfo(`Successfully fetched job ${jobId} from z/OSMF with ${zosmfData.spoolFiles.length} spool files`);
              res.status(200).json({
                success: true,
                data: zosmfData,
              });
              return;
            } catch (zosmfError) {
              logError('Failed to fetch job from z/OSMF', zosmfError, { jobId });
            }
          } else {
            logError(`No LTPA token found for user ${validation.tsoId}`);
          }
        } else {
          logError(`Token validation failed or no tsoId`, { valid: validation.valid, tsoId: validation.tsoId });
        }
      } else {
        logInfo(`No auth token provided for job ${jobId} request`);
      }

      // Job not found in cache or z/OSMF
      res.status(404).json({
        success: false,
        message: `Job ${jobId} not found in cache. The job may have been submitted in a previous session.`,
      });
    } catch (error) {
      logError('Failed to get TSO status', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve TSO status',
      });
    }
  };

  getSpoolContent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId, fileId } = req.params;
      const lines = tsoExecutionService.getSpoolContent(jobId, fileId);

      res.status(200).json({
        success: true,
        data: {
          jobId,
          fileId,
          lines,
          totalLines: lines.length,
        },
      });
    } catch (error) {
      logError('Failed to get spool content', error, req.params);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get spool content',
      });
    }
  };
}
