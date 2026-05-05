export type WorkflowStepName = 'Pull Claims JCL' | 'Validate Report' | 'Create Del Transactions' | 'Validate' | 'NShare Req' | 'One-timer';
export type TSOJobLifecycleStatus = 'queued' | 'active' | 'output' | 'closed' | 'failed';
export interface TSOProgressEvent {
    step: string;
    message: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    stepIndex?: number;
}
export interface TSOStepAwaitingApprovalEvent {
    step: string;
    stepIndex: number;
    nextStep?: string;
}
export interface TSOStepErrorAnalysisEvent {
    step: string;
    stepIndex: number;
    error: string;
    explanation: string;
    suggestions: string[];
}
export interface TSOJclPreviewEvent {
    lines: string[];
}
export interface TSOJobSubmittedEvent {
    jobId: string;
    jobName: string;
    jobLink: string;
}
export interface TSOStatusStep {
    step: string;
    status: string;
    rc?: number;
}
export interface TSOSpoolFile {
    id: string;
    ddname?: string;
    stepname?: string;
    procstep?: string;
    class?: string;
    linesCount: number;
}
export interface TSOJobRecord {
    jobId: string;
    jobName: string;
    owner: string;
    lifecycleStatus: TSOJobLifecycleStatus;
    returnCode?: number;
    statusText?: string;
    stepInfo: TSOStatusStep[];
    spoolFiles: TSOSpoolFile[];
    spoolByFileId: Record<string, string[]>;
    createdAt: string;
    updatedAt: string;
}
export interface TSOExecutePayload {
    issueKey: string;
    socketId?: string;
    analysis: {
        intent: string;
        region?: string;
        claims?: string[];
        summary?: string;
    };
    workflowSteps?: WorkflowStepName[];
}
export declare class TSOExecutionService {
    private zosmfClient;
    private jobs;
    private approvalGates;
    constructor();
    /** Called by the socket handler when the user approves the current step */
    approveStep(socketId: string, editedJcl?: string): void;
    executeInBackground(payload: TSOExecutePayload, ltpaToken: string, emitProgress: (event: TSOProgressEvent) => void, emitOutput: (output: {
        jobId: string;
        lines: string[];
        outputClass?: string;
    }) => void, emitComplete: (completion: {
        jobId: string;
        returnCode: number;
        summary: string;
    }) => void, emitStepAwaiting: (event: TSOStepAwaitingApprovalEvent) => void, emitStepErrorAnalysis: (event: TSOStepErrorAnalysisEvent) => void, emitJclPreview: (event: TSOJclPreviewEvent) => void, emitJobSubmitted: (event: TSOJobSubmittedEvent) => void): Promise<{
        jobId: string;
        jobName: string;
    }>;
    getJob(jobId: string): TSOJobRecord | undefined;
    fetchJobFromZOSMF(jobId: string, ltpaToken: string): Promise<{
        jobId: string;
        jobName: string;
        owner: string;
        status: TSOJobLifecycleStatus;
        returnCode?: number;
        stepInfo: TSOStatusStep[];
        spoolFiles: TSOSpoolFile[];
        updatedAt: string;
    }>;
    private mapZOSMFStatus;
    getSpoolContent(jobId: string, fileId: string): string[];
    private waitForApproval;
    private generateErrorAnalysis;
    private loadTemplateJcl;
    private execute;
    private pollUntilActive;
    private pollUntilFinished;
    private fetchAndEmitSpool;
    private buildJcl;
    private parseReturnCode;
    private isJobComplete;
    private delay;
}
export declare const tsoExecutionService: TSOExecutionService;
//# sourceMappingURL=tso-execution.service.d.ts.map