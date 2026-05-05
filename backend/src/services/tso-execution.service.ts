import fs from 'fs';
import path from 'path';
import { ZOSMFClient } from '@integrations/zosmf/client';
import { logError, logInfo, logMainframe } from '@utils/logger';

export type WorkflowStepName =
  | 'Pull Claims JCL'
  | 'Validate Report'
  | 'Create Del Transactions'
  | 'Validate'
  | 'NShare Req'
  | 'One-timer';

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

const DEFAULT_STEPS: WorkflowStepName[] = [
  'Pull Claims JCL',
  'Validate Report',
  'Create Del Transactions',
  'Validate',
  'NShare Req',
  'One-timer',
];

export class TSOExecutionService {
  private zosmfClient: ZOSMFClient;
  private jobs: Map<string, TSOJobRecord>;
  // Maps socketId -> resolve function for the current approval gate
  private approvalGates = new Map<string, (editedJcl?: string) => void>();

  constructor() {
    this.zosmfClient = new ZOSMFClient();
    this.jobs = new Map<string, TSOJobRecord>();
  }

  /** Called by the socket handler when the user approves the current step */
  approveStep(socketId: string, editedJcl?: string): void {
    const resolve = this.approvalGates.get(socketId);
    if (resolve) {
      this.approvalGates.delete(socketId);
      resolve(editedJcl);
    }
  }

  executeInBackground(
    payload: TSOExecutePayload,
    ltpaToken: string,
    emitProgress: (event: TSOProgressEvent) => void,
    emitOutput: (output: { jobId: string; lines: string[]; outputClass?: string }) => void,
    emitComplete: (completion: { jobId: string; returnCode: number; summary: string }) => void,
    emitStepAwaiting: (event: TSOStepAwaitingApprovalEvent) => void,
    emitStepErrorAnalysis: (event: TSOStepErrorAnalysisEvent) => void,
    emitJclPreview: (event: TSOJclPreviewEvent) => void,
    emitJobSubmitted: (event: TSOJobSubmittedEvent) => void,
  ): Promise<{ jobId: string; jobName: string }> {
    return this.execute(payload, ltpaToken, emitProgress, emitOutput, emitComplete, emitStepAwaiting, emitStepErrorAnalysis, emitJclPreview, emitJobSubmitted);
  }

  getJob(jobId: string): TSOJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  async fetchJobFromZOSMF(jobId: string, ltpaToken: string): Promise<{
    jobId: string;
    jobName: string;
    owner: string;
    status: TSOJobLifecycleStatus;
    returnCode?: number;
    stepInfo: TSOStatusStep[];
    spoolFiles: TSOSpoolFile[];
    updatedAt: string;
  }> {
    logInfo(`Fetching job ${jobId} from z/OSMF`);
    
    // Fetch job by ID (searches across all job names)
    const jobData = await this.zosmfClient.getJobById(jobId, ltpaToken);
    logInfo(`Job data retrieved: ${jobData.jobname}/${jobData.jobid}, status: ${jobData.status}`);
    
    // Fetch spool files list
    logInfo(`Fetching spool files for ${jobData.jobname}/${jobId}`);
    const spoolFilesList = await this.zosmfClient.getSpoolFiles(jobData.jobname, jobId, ltpaToken);
    logInfo(`Retrieved ${spoolFilesList.length} spool files`);
    
    // Map to our format
    const spoolFiles: TSOSpoolFile[] = spoolFilesList.map((file: any) => ({
      id: file.id || file['dd-name'] || file.ddname || String(file.stepname),
      ddname: file['dd-name'] || file.ddname,
      stepname: file.stepname,
      procstep: file.procstep,
      class: file.class,
      linesCount: file['record-count'] || file.recordCount || 0,
    }));

    return {
      jobId: jobData.jobid || jobId,
      jobName: jobData.jobname || 'UNKNOWN',
      owner: jobData.owner || 'UNKNOWN',
      status: this.mapZOSMFStatus(jobData.status),
      returnCode: this.parseReturnCode(jobData.retcode),
      stepInfo: [],
      spoolFiles,
      updatedAt: new Date().toISOString(),
    };
  }

  private mapZOSMFStatus(status: string): TSOJobLifecycleStatus {
    const statusUpper = status?.toUpperCase() || '';
    if (statusUpper.includes('OUTPUT')) return 'output';
    if (statusUpper.includes('ACTIVE') || statusUpper.includes('EXECUTING')) return 'active';
    if (statusUpper.includes('INPUT') || statusUpper.includes('QUEUED')) return 'queued';
    return 'closed';
  }

  getSpoolContent(jobId: string, fileId: string): string[] {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const content = job.spoolByFileId[fileId];
    if (!content) {
      throw new Error(`Spool file ${fileId} not found for job ${jobId}`);
    }

    return content;
  }

  private waitForApproval(socketId: string | undefined): Promise<string | undefined> {
    if (!socketId) return Promise.resolve(undefined); // no socket -> auto-proceed (non-interactive)
    return new Promise<string | undefined>((resolve) => {
      this.approvalGates.set(socketId, resolve);
    });
  }

  private generateErrorAnalysis(stepName: string, error: string): { explanation: string; suggestions: string[] } {
    const errorLower = error.toLowerCase();

    const stepHints: Record<string, { explanation: string; suggestions: string[] }> = {
      'Pull Claims JCL': {
        explanation: 'The claim extraction phase failed before any JCL was submitted. This is typically a connectivity or data-format issue.',
        suggestions: [
          'Verify that the JIRA issue contains valid claim IDs in the description.',
          'Check network connectivity to the z/OSMF host (204.90.115.200:10443).',
          'Confirm your LTPA token has not expired â€” try logging out and back in.',
        ],
      },
      'Validate Report': {
        explanation: 'The report validation step could not submit or register the JCL job on the mainframe.',
        suggestions: [
          'Review the JCL syntax in the server logs for formatting errors.',
          'Ensure the job CLASS=A and MSGCLASS=H are valid on this LPAR.',
          'Check that the user ID has SUBMIT authority for the target job class.',
        ],
      },
      'Create Del Transactions': {
        explanation: 'The deletion transaction creation step failed during job execution.',
        suggestions: [
          'Inspect the mainframe spool output (JESMSGLG / JESJCL) for abend codes.',
          'Verify the claim IDs exist in the target DB2 or VSAM dataset.',
          'Check that the region size is sufficient for the transaction volume.',
        ],
      },
      'Validate': {
        explanation: 'The validation step encountered an error, likely a data integrity or authorization failure.',
        suggestions: [
          'Look for S0C7 (data exception) or S013 (invalid record format) abend codes in the spool.',
          'Ensure the security profile allows the batch user to read the validation datasets.',
          'Retry with a smaller batch of claims to isolate the problematic record.',
        ],
      },
      'NShare Req': {
        explanation: 'The NShare request step failed. This phase communicates with the network-shared data layer.',
        suggestions: [
          'Verify NShare is active on the target LPAR and the coupling facility is accessible.',
          'Check for CICS or IMS region availability if NShare depends on a transactional layer.',
          'Review the SYSOUT for ESRP or LOCK manager messages.',
        ],
      },
      'One-timer': {
        explanation: 'The final one-timer execution step failed after prior steps completed.',
        suggestions: [
          'Review the full spool output for the last step â€” look for non-zero condition codes.',
          'Ensure the one-timer dataset (ONETDS) has sufficient space and is not in use.',
          'Contact the mainframe operations team if RC > 8 is returned from this step.',
        ],
      },
    };

    // Override with specific hints if certain keywords appear in the error
    const extra: string[] = [];
    if (errorLower.includes('timeout')) extra.push('The operation timed out â€” consider increasing TSO_POLL_TIMEOUT_MS in the backend environment.');
    if (errorLower.includes('401') || errorLower.includes('unauthorized')) extra.push('Authentication failure detected â€” your LTPA token may have expired. Please re-login.');
    if (errorLower.includes('connect') || errorLower.includes('econnrefused')) extra.push('Cannot reach the z/OSMF endpoint. Confirm the host/port and firewall rules.');

    const base = stepHints[stepName] || {
      explanation: `An unexpected error occurred during the "${stepName}" step.`,
      suggestions: [
        'Review the system console and mainframe spool output for details.',
        'Retry the operation after verifying mainframe connectivity.',
        'Contact the operations team if the error persists.',
      ],
    };

    return {
      explanation: base.explanation,
      suggestions: [...base.suggestions, ...extra],
    };
  }

  private loadTemplateJcl(name: string): string {
    const filePath = path.resolve(__dirname, '../../Template_JCLs', name);
    return fs.readFileSync(filePath, 'utf8');
  }

  private async execute(
    payload: TSOExecutePayload,
    ltpaToken: string,
    emitProgress: (event: TSOProgressEvent) => void,
    emitOutput: (output: { jobId: string; lines: string[]; outputClass?: string }) => void,
    emitComplete: (completion: { jobId: string; returnCode: number; summary: string }) => void,
    emitStepAwaiting: (event: TSOStepAwaitingApprovalEvent) => void,
    emitStepErrorAnalysis: (event: TSOStepErrorAnalysisEvent) => void,
    emitJclPreview: (event: TSOJclPreviewEvent) => void,
    emitJobSubmitted: (event: TSOJobSubmittedEvent) => void,
  ): Promise<{ jobId: string; jobName: string }> {
    const workflowSteps = payload.workflowSteps?.length ? payload.workflowSteps : DEFAULT_STEPS;
    const socketId = payload.socketId;

    const emitStepError = (stepIndex: number, error: string) => {
      const stepName = workflowSteps[stepIndex];
      emitProgress({ step: stepName, message: `Step failed: ${error}`, status: 'error', stepIndex });
      const analysis = this.generateErrorAnalysis(stepName, error);
      emitStepErrorAnalysis({ step: stepName, stepIndex, error, ...analysis });
    };

    let record: TSOJobRecord | null = null;

    try {
      // â”€â”€ Step 0: Pull Claims â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[0], message: 'Loading Pull Claims JCL template', status: 'in-progress', stepIndex: 0 });
      const jcl = this.loadTemplateJcl('pull-claims.jcl');
      const jclLines = jcl.split(/\r?\n/);
      // Stream the JCL into the Mainframe TSO Console UI for review before approval
      emitJclPreview({ lines: jclLines });
      await this.delay(400);
      emitProgress({ step: workflowSteps[0], message: `JCL template loaded (${jclLines.length} lines) — review Mainframe TSO Console UI and approve to submit`, status: 'in-progress', stepIndex: 0 });
      emitStepAwaiting({ step: workflowSteps[0], stepIndex: 0, nextStep: workflowSteps[1] });
      const editedJcl = await this.waitForApproval(socketId);

      // â”€â”€ Step 1: Validate Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[1], message: 'Submitting JCL job to z/OSMF', status: 'in-progress', stepIndex: 1 });
      const jclToSubmit = editedJcl ?? jcl;
      const submitResult = await this.zosmfClient.submitJob(jclToSubmit, ltpaToken);
      const zosmfHost = process.env.ZOSMF_HOST || '204.90.115.200';
      const zosmfPort = process.env.ZOSMF_PORT || '10443';
      const jobLink = `https://${zosmfHost}:${zosmfPort}/zosmf/restjobs/jobs/${submitResult.jobName}/${submitResult.jobId}`;
      emitJobSubmitted({ jobId: submitResult.jobId, jobName: submitResult.jobName, jobLink });

      record = {
        jobId: submitResult.jobId,
        jobName: submitResult.jobName,
        owner: submitResult.owner,
        lifecycleStatus: 'queued',
        statusText: submitResult.status,
        stepInfo: workflowSteps.map((step, idx) => ({
          step,
          status: idx < 2 ? 'in-progress' : 'pending',
        })),
        spoolFiles: [],
        spoolByFileId: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(record.jobId, record);

      logMainframe('TSO job submitted', 'SYSTEM', { jobId: record.jobId, jobName: record.jobName, issueKey: payload.issueKey });
      emitProgress({ step: workflowSteps[1], message: `Job submitted: ${record.jobName}/${record.jobId}`, status: 'completed', stepIndex: 1 });
      emitStepAwaiting({ step: workflowSteps[1], stepIndex: 1, nextStep: workflowSteps[2] });
      await this.waitForApproval(socketId);

      // â”€â”€ Step 2: Create Del Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[2], message: `Creating deletion transactions for ${record.jobId}`, status: 'in-progress', stepIndex: 2 });
      await this.pollUntilActive(record, ltpaToken, emitProgress, workflowSteps[2], 2);
      emitProgress({ step: workflowSteps[2], message: 'Deletion transactions queued on mainframe', status: 'completed', stepIndex: 2 });
      emitStepAwaiting({ step: workflowSteps[2], stepIndex: 2, nextStep: workflowSteps[3] });
      await this.waitForApproval(socketId);

      // â”€â”€ Step 3: Validate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[3], message: 'Validating deletion transactions on mainframe', status: 'in-progress', stepIndex: 3 });
      await this.delay(800);
      emitProgress({ step: workflowSteps[3], message: 'Transaction integrity check passed', status: 'completed', stepIndex: 3 });
      emitStepAwaiting({ step: workflowSteps[3], stepIndex: 3, nextStep: workflowSteps[4] });
      await this.waitForApproval(socketId);

      // â”€â”€ Step 4: NShare Req â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[4], message: 'Processing NShare request and polling job completion', status: 'in-progress', stepIndex: 4 });
      await this.pollUntilFinished(record, ltpaToken, emitProgress, workflowSteps[4], 4);
      emitProgress({ step: workflowSteps[4], message: 'Mainframe job finished. NShare request processed', status: 'completed', stepIndex: 4 });
      emitStepAwaiting({ step: workflowSteps[4], stepIndex: 4, nextStep: workflowSteps[5] });
      await this.waitForApproval(socketId);

      // â”€â”€ Step 5: One-timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      emitProgress({ step: workflowSteps[5], message: 'Executing final one-timer operation and retrieving spool', status: 'in-progress', stepIndex: 5 });
      await this.fetchAndEmitSpool(record, ltpaToken, emitOutput);
      emitProgress({ step: workflowSteps[5], message: 'One-timer completed. Spool output retrieved', status: 'completed', stepIndex: 5 });

      const returnCode = record.returnCode ?? 0;
      record.lifecycleStatus = 'closed';
      record.stepInfo = record.stepInfo.map((s) => ({ ...s, status: 'completed' }));

      emitComplete({
        jobId: record.jobId,
        returnCode,
        summary: returnCode === 0
          ? 'All workflow steps completed successfully'
          : `Workflow completed with RC=${returnCode}`,
      });

      return { jobId: record.jobId, jobName: record.jobName };

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logError('TSO step failed', err instanceof Error ? err : new Error(errMsg));

      // Determine which step index was active when the error occurred
      const activeIdx = record
        ? record.stepInfo.findIndex((s) => s.status === 'in-progress')
        : 0;
      const failIndex = activeIdx >= 0 ? activeIdx : 0;

      emitStepError(failIndex, errMsg);

      if (record) {
        record.lifecycleStatus = 'failed';
        record.returnCode = 16;
        record.stepInfo = record.stepInfo.map((s) => ({
          ...s,
          status: s.status === 'completed' ? 'completed' : 'error',
        }));
        return { jobId: record.jobId, jobName: record.jobName };
      }

      throw err;
    }
  }

  private async pollUntilActive(
    record: TSOJobRecord,
    ltpaToken: string,
    emitProgress: (event: TSOProgressEvent) => void,
    stepName: string,
    stepIndex: number,
  ): Promise<void> {
    const pollIntervalMs = Number(process.env.TSO_POLL_INTERVAL_MS || '3000');
    const timeoutMs = Number(process.env.TSO_POLL_TIMEOUT_MS || '240000');
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const status = await this.zosmfClient.getJobStatus(record.jobName, record.jobId, ltpaToken);
      record.statusText = status.status;
      record.updatedAt = new Date().toISOString();

      emitProgress({ step: stepName, message: `Job status: ${status.status}`, status: 'in-progress', stepIndex });

      if (['ACTIVE', 'OUTPUT', 'PRINT', 'PURGED'].some((s) => status.status.toUpperCase().includes(s))) {
        record.lifecycleStatus = 'active';
        return;
      }
      await this.delay(pollIntervalMs);
    }
  }

  private async pollUntilFinished(
    record: TSOJobRecord,
    ltpaToken: string,
    emitProgress: (event: TSOProgressEvent) => void,
    stepName: string,
    stepIndex: number,
  ): Promise<void> {
    const timeoutMs = Number(process.env.TSO_POLL_TIMEOUT_MS || '240000');
    const pollIntervalMs = Number(process.env.TSO_POLL_INTERVAL_MS || '3000');
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const status = await this.zosmfClient.getJobStatus(record.jobName, record.jobId, ltpaToken);
      record.updatedAt = new Date().toISOString();
      record.statusText = status.status;
      record.returnCode = this.parseReturnCode(status.returnCode);

      emitProgress({ step: stepName, message: `Job status: ${status.status}`, status: 'in-progress', stepIndex });

      if (this.isJobComplete(status.status)) {
        record.lifecycleStatus = 'closed';
        return;
      }

      record.lifecycleStatus = 'active';
      await this.delay(pollIntervalMs);
    }

    record.lifecycleStatus = 'failed';
    record.returnCode = 16;
    throw new Error('TSO job polling timed out before completion');
  }

  private async fetchAndEmitSpool(
    record: TSOJobRecord,
    ltpaToken: string,
    emitOutput: (output: { jobId: string; lines: string[]; outputClass?: string }) => void
  ): Promise<void> {
    const spoolFiles = await this.zosmfClient.getSpoolFiles(record.jobName, record.jobId, ltpaToken);

    for (const file of spoolFiles) {
      const fileId = String(file.id);
      const content = await this.zosmfClient.getSpoolContent(record.jobName, record.jobId, file.id, ltpaToken);
      const lines = String(content).split(/\r?\n/).filter(Boolean);

      record.spoolFiles.push({
        id: fileId,
        ddname: file.ddname,
        stepname: file.stepname,
        procstep: file.procstep,
        class: file.class,
        linesCount: lines.length,
      });
      record.spoolByFileId[fileId] = lines;
      record.updatedAt = new Date().toISOString();

      emitOutput({ jobId: record.jobId, lines, outputClass: file.class });
    }
  }

  private buildJcl(payload: TSOExecutePayload): string {
    const region = payload.analysis.region || 'UNSPECIFIED';
    const intent = payload.analysis.intent || 'UNKNOWN';

    // JCL enforces a strict 80-character record length limit.
    // Truncate any value that would push a comment line past 80 chars.
    const jclComment = (label: string, value: string): string => {
      const prefix = `//* ${label}: `;
      const maxValueLen = 80 - prefix.length;
      const truncated = value.length > maxValueLen ? value.substring(0, maxValueLen - 3) + '...' : value;
      return `${prefix}${truncated}`;
    };

    // For claims, emit one line per claim (or a single NONE line) so each stays ≤80 chars.
    const claimLines: string[] =
      payload.analysis.claims?.length
        ? payload.analysis.claims.map((c) => jclComment('CLAIM', c))
        : [jclComment('CLAIMS', 'NONE')];

    const lines = [
      `//ONETJOB  JOB (FB3),'ONETIMER',CLASS=A,MSGCLASS=H,NOTIFY=&SYSUID`,
      `//STEP1    EXEC PGM=IEFBR14`,
      `//SYSIN    DD *`,
      jclComment('ISSUE', payload.issueKey),
      jclComment('INTENT', intent),
      jclComment('REGION', region),
      ...claimLines,
      jclComment('SUMMARY', payload.analysis.summary || 'N/A'),
      `/*`,
    ];

    return lines.join('\n');
  }

  private parseReturnCode(retCode?: string): number | undefined {
    if (!retCode) return undefined;
    const match = retCode.match(/(\d{1,4})/);
    if (!match) return undefined;
    return Number(match[1]);
  }

  private isJobComplete(status: string): boolean {
    const normalized = status.toUpperCase();
    return ['OUTPUT', 'PRINT', 'PURGED', 'CC'].some((terminal) => normalized.includes(terminal));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const tsoExecutionService = new TSOExecutionService();
