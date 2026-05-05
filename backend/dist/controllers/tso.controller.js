"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TSOController = void 0;
const auth_service_simple_1 = require("@services/auth.service.simple");
const tso_execution_service_1 = require("@services/tso-execution.service");
const logger_1 = require("@utils/logger");
class TSOController {
    io;
    authService;
    constructor(io) {
        this.io = io;
        this.authService = new auth_service_simple_1.AuthService();
    }
    /** Delegate step approval to the execution service */
    approveStep(socketId, editedJcl) {
        tso_execution_service_1.tsoExecutionService.approveStep(socketId, editedJcl);
    }
    executeTSO = async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');
            const body = req.body;
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
            const ltpaToken = auth_service_simple_1.AuthService.getMainframeToken(validation.tsoId);
            if (!ltpaToken) {
                res.status(401).json({
                    success: false,
                    message: 'Mainframe session not found. Please login again.',
                });
                return;
            }
            const emitProgress = (event) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:progress', event);
                }
            };
            const emitOutput = (output) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:output', output);
                }
            };
            const emitComplete = (completion) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:complete', completion);
                }
            };
            const emitStepAwaiting = (event) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:step-awaiting-approval', event);
                }
            };
            const emitStepErrorAnalysis = (event) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:step-error-analysis', event);
                }
            };
            const emitJclPreview = (event) => {
                if (body.socketId) {
                    this.io.to(body.socketId).emit('tso:jcl-preview', event);
                }
            };
            const emitJobSubmitted = (event) => {
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
            tso_execution_service_1.tsoExecutionService.executeInBackground({
                issueKey: body.issueKey,
                socketId: body.socketId,
                workflowSteps: body.workflowSteps,
                analysis: body.analysis,
            }, ltpaToken, emitProgress, emitOutput, emitComplete, emitStepAwaiting, emitStepErrorAnalysis, emitJclPreview, emitJobSubmitted).then((submission) => {
                (0, logger_1.logInfo)('TSO execution completed', {
                    issueKey: body.issueKey,
                    jobId: submission.jobId,
                    user: validation.tsoId,
                });
            }).catch((error) => {
                (0, logger_1.logError)('TSO background execution failed', error instanceof Error ? error : new Error(String(error)));
            });
        }
        catch (error) {
            (0, logger_1.logError)('TSO execution failed', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to execute TSO job',
            });
        }
    };
    getJobStatus = async (req, res) => {
        try {
            const { jobId } = req.params;
            const authHeader = req.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');
            // Try to get from cache first
            const record = tso_execution_service_1.tsoExecutionService.getJob(jobId);
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
                const validation = await this.authService.validateToken(token);
                if (validation.valid && validation.tsoId) {
                    const ltpaToken = auth_service_simple_1.AuthService.getMainframeToken(validation.tsoId);
                    if (ltpaToken) {
                        try {
                            const zosmfData = await tso_execution_service_1.tsoExecutionService.fetchJobFromZOSMF(jobId, ltpaToken);
                            res.status(200).json({
                                success: true,
                                data: zosmfData,
                            });
                            return;
                        }
                        catch (zosmfError) {
                            (0, logger_1.logError)('Failed to fetch job from z/OSMF', zosmfError);
                        }
                    }
                }
            }
            // Job not found in cache or z/OSMF
            res.status(404).json({
                success: false,
                message: `Job ${jobId} not found in cache. The job may have been submitted in a previous session.`,
            });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get TSO status', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve TSO status',
            });
        }
    };
    getSpoolContent = async (req, res) => {
        try {
            const { jobId, fileId } = req.params;
            const lines = tso_execution_service_1.tsoExecutionService.getSpoolContent(jobId, fileId);
            res.status(200).json({
                success: true,
                data: {
                    jobId,
                    fileId,
                    lines,
                    totalLines: lines.length,
                },
            });
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get spool content', error, req.params);
            res.status(404).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to get spool content',
            });
        }
    };
}
exports.TSOController = TSOController;
//# sourceMappingURL=tso.controller.js.map