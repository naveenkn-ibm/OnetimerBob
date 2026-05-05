import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AlertCircle,
  ArrowUpDown,
  Bot,
  Calendar,
  CheckCircle,
  Clipboard,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  LogOut,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  api,
  handleApiError,
  IntentAnalysisResult,
} from '../utils/api';

interface JiraData {
  key: string;
  fields: {
    summary: string;
    description: string;
    status: string | { name: string };
    issuetype: string | { name: string };
    priority?: string | { name: string };
    assignee?: string | { displayName: string; emailAddress: string };
    reporter?: string | { displayName: string; emailAddress: string };
    created: string;
    updated: string;
    labels?: string[];
    attachment?: Array<{
      id: string;
      filename: string;
      size: number;
      mimeType: string;
      content: string;
      created: string;
      author?: { displayName: string };
    }>;
    [key: string]: unknown;
  };
}

interface BTPIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
    created: string;
  };
}

type JiraAttachment = NonNullable<JiraData['fields']['attachment']>[number];

type WorkflowStatus = 'pending' | 'in-progress' | 'completed' | 'error';

type HumanLoopStatus = 'pending' | 'approved' | 'editing' | 'rejected';

interface WorkflowStep {
  name: string;
  status: WorkflowStatus;
}

interface ChatMessage {
  id: string;
  type: 'system' | 'user' | 'ai' | 'mainframe' | 'jira' | 'workflow' | 'performance' | 'security' | 'debug';
  message: string;
  timestamp: Date;
  category?: 'info' | 'warning' | 'error' | 'success';
  details?: string;
  jobId?: string;
  jobName?: string;
  spoolFiles?: Array<{ ddname: string; id: string; lines?: string[] }>;
}

const WORKFLOW_STEP_NAMES = [
  'Pull Claims JCL',
  'Validate Report',
  'Create Del Transactions',
  'Validate',
  'NShare Req',
  'One-timer',
] as const;

const getDefaultWorkflow = (): WorkflowStep[] =>
  WORKFLOW_STEP_NAMES.map((name) => ({ name, status: 'pending' }));

const Workspace: React.FC = () => {
  const { user, logout } = useAuth();

  const [csrId, setCsrId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jiraData, setJiraData] = useState<JiraData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<IntentAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(getDefaultWorkflow());
  const [humanLoopStatus, setHumanLoopStatus] = useState<HumanLoopStatus>('pending');

  const [jobState, setJobState] = useState<{
    jobId: string | null;
    jobName: string | null;
    jobLink: string | null;
    status: string;
    currentStage: string;
    returnCode: number | null;
    error: string | null;
    outputLines: string[];
  }>({
    jobId: null,
    jobName: null,
    jobLink: null,
    status: 'idle',
    currentStage: 'Waiting for approval',
    returnCode: null,
    error: null,
    outputLines: [],
  });

  const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
  const [editedIntent, setEditedIntent] = useState('');
  const [editedRegion, setEditedRegion] = useState('');
  const [editedClaims, setEditedClaims] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [consoleFilter, setConsoleFilter] = useState<string>('all');
  const [consoleSearch, setConsoleSearch] = useState('');

  const [btpIssues, setBtpIssues] = useState<BTPIssue[]>([]);
  const [isBtpLoading, setIsBtpLoading] = useState(false);

  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [consoleNewest, setConsoleNewest] = useState(true);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [claimsCopied, setClaimsCopied] = useState(false);

  // JCL editor state
  const [jclContent, setJclContent] = useState<string>('');
  const [isJclEditing, setIsJclEditing] = useState(false);
  const jclBeforeEditRef = useRef<string>('');

  // Spool viewer state
  const [spoolViewerOpen, setSpoolViewerOpen] = useState(false);
  const [spoolFiles, setSpoolFiles] = useState<Array<{ id: string; ddname?: string; linesCount: number }>>([]);
  const [spoolFileContents, setSpoolFileContents] = useState<Record<string, string[]>>({});
  const [selectedSpoolDd, setSelectedSpoolDd] = useState<string>('');
  const [isLoadingSpool, setIsLoadingSpool] = useState(false);

  // Job lifecycle badge: idle | submitted | running | completed | failed
  const [jobLifecycle, setJobLifecycle] = useState<'idle' | 'submitted' | 'running' | 'completed' | 'failed'>('idle');

  // Per-step approval gate
  const [stepAwaitingApproval, setStepAwaitingApproval] = useState<{
    step: string;
    stepIndex: number;
    nextStep?: string;
  } | null>(null);

  // AI error analysis for failed steps
  const [stepErrorAnalysis, setStepErrorAnalysis] = useState<{
    step: string;
    stepIndex: number;
    error: string;
    explanation: string;
    suggestions: string[];
  } | null>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const tsoOutputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socketInstance = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
    });

    socketInstance.on('connect', () => {
      addChatMessage('system', `Realtime channel connected (${socketInstance.id})`, 'success');
    });

    socketInstance.on('ai:progress', (progress: { message: string }) => {
      addChatMessage('ai', progress.message, 'info');
    });

    socketInstance.on(
      'tso:progress',
      (progress: { step: string; message: string; status: 'pending' | 'in-progress' | 'completed' | 'error'; stepIndex?: number }) => {
        setJobState((prev) => ({
          ...prev,
          currentStage: progress.step,
          status: progress.status === 'error' ? 'failed' : 'running',
        }));
        setWorkflowStepStatus(progress.step, progress.status);
        const cat = progress.status === 'error' ? 'error' : progress.status === 'completed' ? 'success' : 'info';
        addChatMessage(
          progress.status === 'error' ? 'debug' : 'workflow',
          `[${progress.step}] ${progress.message}`,
          cat,
        );
      }
    );

    socketInstance.on('tso:step-awaiting-approval', (event: { step: string; stepIndex: number; nextStep?: string }) => {
      setStepAwaitingApproval(event);
      addChatMessage(
        'workflow',
        `Step "${event.step}" awaiting your approval${event.nextStep ? ` — next: "${event.nextStep}"` : ''}`,
        'warning',
      );
    });

    socketInstance.on(
      'tso:step-error-analysis',
      (event: { step: string; stepIndex: number; error: string; explanation: string; suggestions: string[] }) => {
        setStepErrorAnalysis(event);
        addChatMessage('debug', `[ERROR] Step "${event.step}" failed: ${event.error}`, 'error', event.explanation);
        event.suggestions.forEach((s) => addChatMessage('debug', `  → ${s}`, 'warning'));
      }
    );

    socketInstance.on('tso:output', (payload: { lines: string[]; jobId: string }) => {
      const bounded = payload.lines.slice(0, 200);
      setJobState((prev) => ({
        ...prev,
        jobId: prev.jobId || payload.jobId,
        outputLines: [...prev.outputLines, ...bounded].slice(-600),
      }));
      addChatMessage('mainframe', `Received ${bounded.length} spool line(s) for job ${payload.jobId}`, 'success');
    });

    socketInstance.on('tso:jcl-preview', (payload: { lines: string[] }) => {
      const content = payload.lines.join('\n');
      setJclContent(content);
      jclBeforeEditRef.current = content;
      setJobState((prev) => ({
        ...prev,
        outputLines: [...prev.outputLines, '--- JCL TEMPLATE (pull-claims.jcl) ---', ...payload.lines, '--- END JCL ---'].slice(-600),
      }));
      addChatMessage('mainframe', `Pull Claims JCL template loaded (${payload.lines.length} lines) — review in Mainframe TSO Console UI`, 'info');
    });

    socketInstance.on('tso:job-submitted', (payload: { jobId: string; jobName: string; jobLink: string }) => {
      setJobState((prev) => ({
        ...prev,
        jobId: payload.jobId,
        jobName: payload.jobName,
        jobLink: payload.jobLink,
      }));
      setJobLifecycle('submitted');
      setTimeout(() => setJobLifecycle('running'), 1000);
      
      // Don't add to System Console - job info will be displayed in JCL Window header
    });

    socketInstance.on('tso:complete', (payload: { jobId: string; returnCode: number; summary: string }) => {
      setStepAwaitingApproval(null);
      setJobState((prev) => ({
        ...prev,
        jobId: payload.jobId,
        returnCode: payload.returnCode,
        status: payload.returnCode === 0 ? 'completed' : 'failed',
        currentStage: payload.summary,
      }));
      setJobLifecycle(payload.returnCode === 0 ? 'completed' : 'failed');
      setWorkflowSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: payload.returnCode === 0 ? 'completed' : step.status === 'completed' ? 'completed' : 'error',
        }))
      );
      const success = payload.returnCode === 0;
      addChatMessage(
        'workflow',
        `Workflow ${success ? 'completed successfully' : `finished with RC=${payload.returnCode}`}: ${payload.summary}`,
        success ? 'success' : 'error',
      );
    });

    socketInstance.on('disconnect', () => {
      addChatMessage('system', 'Realtime channel disconnected', 'warning');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (tsoOutputRef.current) {
      tsoOutputRef.current.scrollTop = tsoOutputRef.current.scrollHeight;
    }
  }, [jobState.outputLines]);

  useEffect(() => {
    fetchBTPIssues();
  }, []);

  const addChatMessage = (
    type: ChatMessage['type'],
    message: string,
    category?: ChatMessage['category'],
    details?: string,
    jobId?: string,
    jobName?: string
  ) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date(),
        category,
        details,
        jobId,
        jobName,
      },
    ]);
  };

  const setWorkflowStepStatus = (stepName: string, status: WorkflowStatus) => {
    setWorkflowSteps((prev) =>
      prev.map((step) => {
        if (step.name === stepName) {
          return { ...step, status };
        }
        return step;
      })
    );
  };

  const resetExecutionState = () => {
    setWorkflowSteps(getDefaultWorkflow());
    setHumanLoopStatus('pending');
    setIsEditingAnalysis(false);
    setStepAwaitingApproval(null);
    setStepErrorAnalysis(null);
    setJclContent('');
    setIsJclEditing(false);
    setSpoolViewerOpen(false);
    setSpoolFiles([]);
    setSpoolFileContents({});
    setSelectedSpoolDd('');
    setJobLifecycle('idle');
    setJobState({
      jobId: null,
      jobName: null,
      jobLink: null,
      status: 'idle',
      currentStage: 'Waiting for approval',
      returnCode: null,
      error: null,
      outputLines: [],
    });
  };

  const handleFetchJiraIssue = async (issueKeyOverride?: string) => {
    const issueKey = issueKeyOverride || csrId;
    if (!issueKey.trim()) {
      setError('Please enter a CSR/Issue ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAiError(null);
    setChatMessages([]);
    setJiraData(null);
    setAiAnalysis(null);
    resetExecutionState();
    setWorkflowStepStatus('Pull Claims JCL', 'in-progress');

    addChatMessage('security', `User ${user?.tsoId} initiated issue fetch`, 'info');
    addChatMessage('jira', `Fetching issue ${issueKey.trim()} from JIRA`, 'info');

    if (issueKeyOverride) {
      setCsrId(issueKeyOverride);
    }

    try {
      const issueResponse = await api.getJiraIssue(issueKey.trim());
      setJiraData(issueResponse.data);
      addChatMessage('jira', `Issue ${issueKey.trim()} loaded`, 'success');

      const issueDataForAI = {
        ...issueResponse.data,
        fields: {
          ...issueResponse.data.fields,
          attachment: issueResponse.data.fields.attachment?.map((att: any) => ({
            id: att.id,
            filename: att.filename,
            size: att.size,
            mimeType: att.mimeType,
            created: att.created,
            author: att.author,
          })),
        },
      };

      setIsAnalyzing(true);
      addChatMessage('ai', 'Analyzing intent and entities', 'info');
      const aiResponse = await api.analyzeCSR(issueDataForAI, socket?.id);
      setAiAnalysis(aiResponse.data);
      setEditedIntent(aiResponse.data.intent);
      setEditedRegion(aiResponse.data.region || '');
      setEditedClaims((aiResponse.data.claims || []).join(', '));

      setWorkflowStepStatus('Pull Claims JCL', 'completed');
      setWorkflowStepStatus('Validate Report', 'in-progress');
      addChatMessage('workflow', 'Analysis ready for human decision', 'success');
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      addChatMessage('debug', 'Issue fetch or analysis failed', 'error', apiError.message);
      setWorkflowStepStatus('Pull Claims JCL', 'error');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleReanalyze = async () => {
    if (!jiraData || !aiAnalysis) {
      return;
    }

    setAiError(null);
    setIsAnalyzing(true);
    addChatMessage('user', 'Applying edits and running re-analysis', 'info');

    try {
      const corrections = {
        intent: editedIntent || aiAnalysis.intent,
        region: editedRegion || aiAnalysis.region,
        claims: editedClaims
          ? editedClaims
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean)
          : aiAnalysis.claims,
      };

      const issueDataForAI = {
        ...jiraData,
        fields: {
          ...jiraData.fields,
          attachment: jiraData.fields.attachment?.map((att: any) => ({
            id: att.id,
            filename: att.filename,
            size: att.size,
            mimeType: att.mimeType,
            created: att.created,
            author: att.author,
          })),
        },
      };

      const response = await api.reanalyzeCSR(issueDataForAI, corrections, socket?.id);
      setAiAnalysis(response.data);
      setEditedIntent(response.data.intent);
      setEditedRegion(response.data.region || '');
      setEditedClaims((response.data.claims || []).join(', '));
      setIsEditingAnalysis(false);
      setHumanLoopStatus('pending');
      addChatMessage('ai', 'Re-analysis complete. Ready for approval.', 'success');
    } catch (err) {
      const apiError = handleApiError(err);
      setAiError(apiError.message);
      addChatMessage('debug', 'Re-analysis failed', 'error', apiError.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startWorkflowExecution = async () => {
    if (!jiraData || !aiAnalysis) {
      return;
    }

    // Reset all steps to "Yet to Start" (pending) — backend will drive status via socket events
    const initialSteps = getDefaultWorkflow();
    // Immediately set first step (Pull Claims JCL) to "in-progress"
    initialSteps[0].status = 'in-progress';
    setWorkflowSteps(initialSteps);
    setJclContent('');
    setIsJclEditing(false);
    setSpoolViewerOpen(false);
    setSpoolFiles([]);
    setSpoolFileContents({});
    setSelectedSpoolDd('');
    setJobLifecycle('idle');

    setJobState((prev) => ({
      ...prev,
      status: 'running',
      currentStage: 'Submitting workflow to mainframe',
      error: null,
      outputLines: [],
      returnCode: null,
    }));

    addChatMessage('workflow', 'TSO workflow started', 'info');

    try {
      // Backend responds 202 immediately; all subsequent updates arrive via socket events.
      await api.executeTSO({
        issueKey: jiraData.key,
        socketId: socket?.id,
        workflowSteps: [...WORKFLOW_STEP_NAMES],
        analysis: {
          intent: aiAnalysis.intent,
          region: aiAnalysis.region,
          claims: aiAnalysis.claims,
          summary: aiAnalysis.summary,
        },
      });

      addChatMessage('workflow', 'Workflow accepted by server — monitoring via realtime events', 'success');
    } catch (err) {
      const apiError = handleApiError(err);
      setJobState((prev) => ({
        ...prev,
        status: 'failed',
        error: apiError.message,
      }));
      setWorkflowSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: step.status === 'completed' ? 'completed' : 'error',
        }))
      );
      addChatMessage('mainframe', `Execution failed: ${apiError.message}`, 'error');
    }
  };

  const handleApprove = () => {
    setHumanLoopStatus('approved');
    addChatMessage('security', `Approval logged for user ${user?.tsoId}`, 'info');
    addChatMessage('workflow', 'Human approval granted â€” click Start Workflow to execute', 'success');
  };

  const handleStartWorkflow = () => {
    setWorkflowStarted(true);
    startWorkflowExecution();
  };

  const handleApproveStep = () => {
    if (!socket || !stepAwaitingApproval) return;
    addChatMessage(
      'security',
      `User ${user?.tsoId} approved step "${stepAwaitingApproval.step}" — continuing workflow`,
      'success',
    );
    setStepAwaitingApproval(null);
    setIsJclEditing(false);
    // For Pull Claims JCL, carry the (possibly edited) JCL with the approval
    const payload =
      stepAwaitingApproval.step === 'Pull Claims JCL'
        ? { jcl: jclContent }
        : undefined;
    socket.emit('tso:step-approve', payload);
  };

  const handleRejectStep = () => {
    setStepAwaitingApproval(null);
    setIsJclEditing(false);
    setJobState((prev) => ({
      ...prev,
      status: 'rejected',
      currentStage: 'Workflow rejected by reviewer',
    }));
    setWorkflowSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: step.status === 'completed' ? 'completed' : 'error',
      }))
    );
    addChatMessage('workflow', 'Workflow rejected — JCL submission cancelled', 'error');
  };

  const handleEdit = () => {
    setHumanLoopStatus('editing');
    setIsEditingAnalysis(true);
    addChatMessage('workflow', 'Human requested edits before execution', 'warning');
  };

  const handleReject = () => {
    setHumanLoopStatus('rejected');
    setWorkflowSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: step.status === 'completed' ? 'completed' : 'error',
      }))
    );
    setJobState((prev) => ({
      ...prev,
      status: 'rejected',
      currentStage: 'Execution rejected by reviewer',
    }));
    addChatMessage('workflow', 'Workflow rejected by reviewer', 'error');
  };

  const fetchBTPIssues = async () => {
    setIsBtpLoading(true);
    try {
      const mockIssues: BTPIssue[] = [
        {
          key: 'BTP-5',
          fields: {
            summary: 'Restore Claims from Production',
            status: { name: 'To Do' },
            assignee: { displayName: 'Kiranmai Gurram' },
            created: '2026-05-22T00:00:00.000Z',
          },
        },
        {
          key: 'BTP-4',
          fields: {
            summary: 'Delete Pending claims',
            status: { name: 'To Do' },
            assignee: { displayName: 'NAVEEN NARAYAN RAO' },
            created: '2026-05-31T00:00:00.000Z',
          },
        },
        {
          key: 'BTP-3',
          fields: {
            summary: 'Delete pending claims from Production env',
            status: { name: 'To Do' },
            created: '2026-05-30T00:00:00.000Z',
          },
        },
      ];

      setBtpIssues(mockIssues);
      addChatMessage('jira', `Loaded ${mockIssues.length} BTP issues`, 'success');
    } catch {
      addChatMessage('jira', 'Failed to load BTP issues', 'error');
    } finally {
      setIsBtpLoading(false);
    }
  };

  const handleDownloadAttachment = (attachment: JiraAttachment) => {
    try {
      const binaryString = atob(attachment.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      addChatMessage('debug', 'Attachment download failed', 'error');
    }
  };

  const filteredMessages = useMemo(() => {
    const filtered = chatMessages.filter((msg) => {
      // Exclude workflow messages from System Console
      if (msg.type === 'workflow') return false;
      const matchesFilter = consoleFilter === 'all' || msg.type === consoleFilter;
      const matchesSearch =
        !consoleSearch ||
        msg.message.toLowerCase().includes(consoleSearch.toLowerCase()) ||
        (msg.details && msg.details.toLowerCase().includes(consoleSearch.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
    return consoleNewest ? [...filtered].reverse() : filtered;
  }, [chatMessages, consoleFilter, consoleSearch, consoleNewest]);

  const handleExportLogs = () => {
    const text = chatMessages
      .map((m) => `[${m.timestamp.toISOString()}] [${m.type}] ${m.message}${m.details ? '\n  ' + m.details : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onetimerBob-console-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── JCL syntax highlighting ───────────────────────────────────────────────────
  const highlightJclLine = (line: string): React.ReactNode => {
    if (line.startsWith('//*')) return <span className="text-slate-500">{line}</span>;
    if (line === '/*' || line.startsWith('/* ')) return <span className="text-yellow-300">{line}</span>;
    if (line.startsWith('//')) {
      const match = line.match(/^(\/\/\S*)\s+(\S+)(.*)$/);
      if (match) {
        return (
          <>
            <span className="text-cyan-300">{match[1]}</span>
            <span className="text-yellow-200"> {match[2]}</span>
            <span className="text-slate-300">{match[3]}</span>
          </>
        );
      }
      return <span className="text-cyan-300">{line}</span>;
    }
    return <span className="text-green-200">{line}</span>;
  };

  // ── Open spool viewer ─────────────────────────────────────────────────────────
  const handleOpenSpoolViewer = async () => {
    if (!jobState.jobId) return;
    setSpoolViewerOpen(true);
    setIsLoadingSpool(true);
    setSpoolFileContents({});
    setSelectedSpoolDd('');
    try {
      const statusResp = await api.getTSOStatus(jobState.jobId);
      const files = statusResp.data.spoolFiles;
      setSpoolFiles(files);
      const firstKey = files[0]?.ddname || files[0]?.id || '';
      if (firstKey) setSelectedSpoolDd(firstKey);
      for (const file of files) {
        const key = file.ddname || file.id;
        try {
          const spoolResp = await api.getTSOSpool(jobState.jobId, file.id);
          setSpoolFileContents((prev) => ({ ...prev, [key]: spoolResp.data.lines }));
        } catch {
          setSpoolFileContents((prev) => ({ ...prev, [key]: ['[Error loading spool file]'] }));
        }
      }
    } catch {
      addChatMessage('debug', 'Failed to load spool files', 'error');
    } finally {
      setIsLoadingSpool(false);
    }
  };

  // ── Fetch spool files for a specific job and attach to message ────────────────
  const handleJobLinkClick = async (messageId: string, jobId: string) => {
    // Check if already expanded with spool files
    const msg = chatMessages.find(m => m.id === messageId);
    
    if (msg?.spoolFiles && msg.spoolFiles.length > 0) {
      // Toggle collapse
      setExpandedMessageId(expandedMessageId === messageId ? null : messageId);
      return;
    }

    // Show loading indicator
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, details: 'Loading spool files...' }
          : m
      )
    );
    setExpandedMessageId(messageId);

    // Fetch spool files
    try {
      const statusResp = await api.getTSOStatus(jobId);
      const files = statusResp.data.spoolFiles;
      
      if (!files || files.length === 0) {
        // Update message with helpful info
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  details: `No spool files available yet for job ${jobId}.\n\nPossible reasons:\n• Job is still running\n• Job hasn't generated output yet\n• Job completed but spool files were purged\n\nTry clicking again in a few moments if the job is still running.`,
                  spoolFiles: []
                }
              : m
          )
        );
        return;
      }
      
      // Fetch content for each spool file
      const spoolData: Array<{ ddname: string; id: string; lines?: string[] }> = [];
      for (const file of files) {
        try {
          const spoolResp = await api.getTSOSpool(jobId, file.id);
          spoolData.push({
            ddname: file.ddname || file.id,
            id: file.id,
            lines: spoolResp.data.lines,
          });
        } catch (err) {
          spoolData.push({
            ddname: file.ddname || file.id,
            id: file.id,
            lines: ['[Error loading spool file]'],
          });
        }
      }
      
      // Update the message with spool files
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, spoolFiles: spoolData, details: undefined }
            : m
        )
      );
    } catch (err) {
      // Update message with error details
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                details: `Failed to load spool files for job ${jobId}.\n\nError: ${err}\n\nPlease check:\n• Job ID is correct\n• Backend server is running\n• z/OSMF connection is active`,
                spoolFiles: []
              }
            : m
        )
      );
    }
  };

  // â”€â”€ Reusable System Console panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const systemConsolePanel = (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">System Console</h3>
          {chatMessages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/30 text-blue-300 rounded-full">
              {chatMessages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setConsoleNewest((v) => !v)}
            title={consoleNewest ? 'Showing newest first' : 'Showing oldest first'}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleExportLogs} title="Export logs" className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setChatMessages([])} title="Clear console" className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {['all', 'system', 'ai', 'mainframe', 'jira', 'security', 'debug'].map((filter) => (
          <button
            key={filter}
            onClick={() => setConsoleFilter(filter)}
            className={`px-2 py-0.5 text-[10px] rounded ${
              consoleFilter === filter ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={consoleSearch}
        onChange={(e) => setConsoleSearch(e.target.value)}
        placeholder="Search logs..."
        className="w-full mb-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div ref={consoleRef} className="h-64 overflow-y-auto bg-slate-950 border border-slate-700 rounded p-2 font-mono text-xs">
        {filteredMessages.length === 0 ? (
          <p className="text-slate-500 italic">No matching logs</p>
        ) : (
          filteredMessages.map((msg) => {
            const isExpanded = expandedMessageId === msg.id;
            const hasJobInfo = msg.jobId && msg.jobName;
            const hasSpoolFiles = msg.spoolFiles && msg.spoolFiles.length > 0;
            const showExpandIcon = msg.details || hasJobInfo;
            
            return (
              <div
                key={msg.id}
                className="py-1 border-b border-slate-800 last:border-0 px-1 rounded"
              >
                <div
                  className="flex items-center gap-1 text-slate-500 cursor-pointer hover:bg-slate-900/50"
                  onClick={() => {
                    if (msg.details) {
                      setExpandedMessageId(isExpanded ? null : msg.id);
                    }
                  }}
                >
                  {showExpandIcon ? (
                    isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                  ) : (
                    <span className="w-3" />
                  )}
                  <span>[{msg.timestamp.toLocaleTimeString()}]</span>
                  <span className="uppercase text-[9px]">{msg.type}</span>
                </div>
                <div
                  className={`pl-4 ${
                    msg.category === 'error'
                      ? 'text-red-300'
                      : msg.category === 'warning'
                      ? 'text-yellow-300'
                      : msg.category === 'success'
                      ? 'text-green-300'
                      : 'text-slate-200'
                  }`}
                >
                  {hasJobInfo ? (
                    <span>
                      Job submitted:{' '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJobLinkClick(msg.id, msg.jobId!);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 underline decoration-dotted hover:decoration-solid transition-colors"
                      >
                        {msg.jobName}/{msg.jobId}
                      </button>
                      {hasSpoolFiles && (
                        <span className="ml-2 text-[10px] text-slate-400">
                          ({msg.spoolFiles!.length} spool files)
                        </span>
                      )}
                    </span>
                  ) : (
                    msg.message
                  )}
                </div>
                {isExpanded && msg.details && (
                  <div className="pl-4 mt-1 text-slate-400 whitespace-pre-wrap">{msg.details}</div>
                )}
                {isExpanded && hasSpoolFiles && (
                  <div className="pl-4 mt-2 space-y-2">
                    {msg.spoolFiles!.map((spool, idx) => (
                      <details key={idx} className="bg-slate-900/50 rounded border border-slate-700">
                        <summary className="px-2 py-1 cursor-pointer hover:bg-slate-800/50 text-cyan-300 text-[11px] font-semibold">
                          {spool.ddname} ({spool.lines?.length || 0} lines)
                        </summary>
                        <div className="px-2 py-1 max-h-40 overflow-y-auto bg-slate-950 text-[10px] text-slate-300">
                          {spool.lines?.map((line, lineIdx) => (
                            <div key={lineIdx} className="whitespace-pre font-mono">
                              {line}
                            </div>
                          )) || <div className="text-slate-500 italic">No content</div>}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">OneTimer Bob</h1>
                <p className="text-xs text-slate-400">AI-Powered One-timer Process Modernization</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.tsoId}</p>
                <p className="text-xs text-slate-400">
                  Session: {user?.sessionId ? user.sessionId.slice(0, 12) : 'Active'}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!workflowStarted ? (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
             PRE-WORKFLOW LAYOUT  (old 4-column layout)
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* â”€â”€ Left 2 cols: CSR input + JIRA data + AI Analysis â”€â”€ */}
            <section className="lg:col-span-2 space-y-6">

              {/* CSR Input */}
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-white whitespace-nowrap">Enter CSR / Issue ID</label>
                  <input
                    type="text"
                    value={csrId}
                    onChange={(e) => setCsrId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFetchJiraIssue(); }}
                    placeholder="BTP-5"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleFetchJiraIssue()}
                    disabled={isLoading || !csrId.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {isLoading ? 'Loading...' : 'Fetch & Analyze'}
                  </button>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
              </div>

              {/* JIRA Data */}
              {jiraData && (
                <div className="glass rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-white">{jiraData.key}</span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
                          {typeof jiraData.fields.issuetype === 'string' ? jiraData.fields.issuetype : jiraData.fields.issuetype.name}
                        </span>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-sm rounded-full">
                          {typeof jiraData.fields.status === 'string' ? jiraData.fields.status : jiraData.fields.status.name}
                        </span>
                      </div>
                      <h2 className="text-xl text-white">{jiraData.fields.summary}</h2>
                    </div>
                    <a href={`https://jsw.ibm.com/browse/${jiraData.key}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-300 hover:text-blue-200 flex items-center gap-1 shrink-0">
                      Open in Jira <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Reporter</p>
                      <p className="text-white">
                        {typeof jiraData.fields.reporter === 'string' ? jiraData.fields.reporter : jiraData.fields.reporter?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Assignee</p>
                      <p className="text-white">
                        {typeof jiraData.fields.assignee === 'string' ? jiraData.fields.assignee : jiraData.fields.assignee?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Updated</p>
                      <p className="text-white">{new Date(jiraData.fields.updated).toLocaleString()}</p>
                    </div>
                  </div>
                  {jiraData.fields.attachment && jiraData.fields.attachment.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">Attachments ({jiraData.fields.attachment.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {jiraData.fields.attachment.map((att) => (
                          <button key={att.id} onClick={() => handleDownloadAttachment(att)}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded">
                            {att.filename}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Analysis Results */}
              {(isAnalyzing || aiAnalysis) && (
                <div className="glass rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">AI Analysis Results</h3>
                    {aiAnalysis && (
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        aiAnalysis.confidence >= 80 ? 'bg-green-500/20 text-green-300' :
                        aiAnalysis.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {aiAnalysis.confidence}% confidence
                      </span>
                    )}
                  </div>

                  {isAnalyzing && !aiAnalysis && (
                    <div className="flex items-center gap-3 text-slate-300">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing issue with AI...
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="space-y-4">
                      {aiAnalysis.summary && (
                        <p className="text-sm text-slate-300 italic border-l-2 border-blue-500/50 pl-3">{aiAnalysis.summary}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                          <p className="text-[11px] text-blue-300 mb-1">INTENT</p>
                          {isEditingAnalysis ? (
                            <input value={editedIntent} onChange={(e) => setEditedIntent(e.target.value)}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white" />
                          ) : (
                            <p className="text-sm text-white">{aiAnalysis.intent}</p>
                          )}
                        </div>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded">
                          <p className="text-[11px] text-emerald-300 mb-1">REGION</p>
                          {isEditingAnalysis ? (
                            <input value={editedRegion} onChange={(e) => setEditedRegion(e.target.value)}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white" />
                          ) : (
                            <p className="text-sm text-white">{aiAnalysis.region || 'Not specified'}</p>
                          )}
                        </div>
                        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                          <p className="text-[11px] text-purple-300 mb-1">CLAIMS</p>
                          {isEditingAnalysis ? (
                            <input value={editedClaims} onChange={(e) => setEditedClaims(e.target.value)}
                              placeholder="comma separated"
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white" />
                          ) : (
                            <p className="text-sm text-white font-mono">{(aiAnalysis.claims || []).join(', ') || 'â€”'}</p>
                          )}
                        </div>
                      </div>

                      {isEditingAnalysis && (
                        <div className="flex gap-2">
                          <button onClick={handleReanalyze} disabled={isAnalyzing}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-60 flex items-center gap-2">
                            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                            {isAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                          </button>
                          <button onClick={() => { setIsEditingAnalysis(false); setHumanLoopStatus('pending'); }}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">
                            Cancel
                          </button>
                        </div>
                      )}

                      {aiError && (
                        <div className="p-3 bg-orange-500/10 border border-orange-500/40 rounded text-orange-300 text-sm">
                          {aiError}
                        </div>
                      )}

                      {/* â”€â”€ Human-in-the-Loop controls â”€â”€ */}
                      <div className="border-t border-slate-700 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Human in the Loop
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            humanLoopStatus === 'approved' ? 'bg-green-500/20 text-green-300' :
                            humanLoopStatus === 'rejected' ? 'bg-red-500/20 text-red-300' :
                            humanLoopStatus === 'editing' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {humanLoopStatus}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={handleApprove}
                            disabled={humanLoopStatus === 'approved' || isEditingAnalysis}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm disabled:opacity-50">
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                          <button onClick={handleEdit} disabled={isEditingAnalysis}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50">
                            <Edit3 className="w-4 h-4" /> Edit
                          </button>
                          <button onClick={handleReject} disabled={humanLoopStatus === 'rejected'}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-50">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button onClick={handleStartWorkflow}
                            disabled={humanLoopStatus !== 'approved' || isEditingAnalysis}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-600 hover:to-cyan-700 text-white rounded text-sm font-semibold disabled:opacity-50 transition-all">
                            <Play className="w-4 h-4" /> Start Workflow
                          </button>
                        </div>
                        {humanLoopStatus === 'approved' && (
                          <p className="text-xs text-green-400 mt-2">âœ“ Approved â€” click Start Workflow to begin execution</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* â”€â”€ JIRA Integration col â”€â”€ */}
            <aside className="lg:col-span-1 space-y-6">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">JIRA Integration</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fetchBTPIssues} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">
                      <RefreshCw className={`w-4 h-4 ${isBtpLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="p-1.5 bg-slate-700 text-slate-300 rounded">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {btpIssues.map((issue) => (
                    <button key={issue.key} onClick={() => handleFetchJiraIssue(issue.key)}
                      className="w-full text-left bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-blue-300 font-semibold">{issue.key}</span>
                        <span className="text-xs text-slate-300">{issue.fields.status.name}</span>
                      </div>
                      <p className="text-sm text-white line-clamp-2">{issue.fields.summary}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{issue.fields.assignee?.displayName || 'Unassigned'}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(issue.fields.created).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* â”€â”€ System Console col â”€â”€ */}
            <aside className="lg:col-span-1">
              {systemConsolePanel}
            </aside>
          </div>
        ) : (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
             POST-WORKFLOW LAYOUT  (workflow orchestration + TSO window)
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* -- Workflow Approval Control Panel (3 cols) -- */}
            <section className="lg:col-span-3 glass rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-semibold text-white">Workflow Approval Control</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Review and approve each workflow step before execution</p>

              {/* Approval steps list */}
              <div className="space-y-3">
                {workflowSteps.map((step, index) => {
                  const isAwaitingApproval = stepAwaitingApproval?.step === step.name;
                  const canApprove = step.status === 'in-progress' || isAwaitingApproval;
                  const isCompleted = step.status === 'completed';
                  const isFailed = step.status === 'error';
                  
                  return (
                    <div
                      key={step.name}
                      className={`p-4 rounded-lg border transition-all ${
                        isAwaitingApproval
                          ? 'bg-yellow-500/10 border-yellow-500/40 shadow-lg'
                          : isCompleted
                          ? 'bg-green-500/10 border-green-500/30'
                          : isFailed
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-slate-800/60 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isFailed
                              ? 'bg-red-500 text-white'
                              : canApprove
                              ? 'bg-yellow-500 text-slate-900'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                          </span>
                          <div>
                            <p className={`text-sm font-medium ${
                              isAwaitingApproval ? 'text-yellow-300' :
                              isCompleted ? 'text-green-300' :
                              isFailed ? 'text-red-300' :
                              'text-slate-300'
                            }`}>
                              {step.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {isAwaitingApproval ? 'Awaiting your approval' :
                               isCompleted ? 'Approved & Completed' :
                               isFailed ? 'Failed - Rejected' :
                               step.status === 'in-progress' ? 'In Progress' :
                               'Pending'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Status badge */}
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          isAwaitingApproval
                            ? 'bg-yellow-500/30 text-yellow-200'
                            : isCompleted
                            ? 'bg-green-500/30 text-green-200'
                            : isFailed
                            ? 'bg-red-500/30 text-red-200'
                            : step.status === 'in-progress'
                            ? 'bg-blue-500/30 text-blue-200'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {isAwaitingApproval ? 'Review' :
                           isCompleted ? 'Approved' :
                           isFailed ? 'Rejected' :
                           step.status === 'in-progress' ? 'Running' :
                           'Waiting'}
                        </span>
                      </div>

                      {/* Approval buttons - only show for steps awaiting approval */}
                      {isAwaitingApproval && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                          <button
                            onClick={handleApproveStep}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={handleRejectStep}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Next step indicator for awaiting approval */}
                      {isAwaitingApproval && stepAwaitingApproval.nextStep && (
                        <div className="mt-2 pt-2 border-t border-yellow-500/20">
                          <p className="text-xs text-slate-400">
                            Next: <span className="text-cyan-300 font-medium">{stepAwaitingApproval.nextStep}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall status summary */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {workflowSteps.filter(s => s.status === 'completed').length} / {workflowSteps.length} steps approved
                  </span>
                  {stepAwaitingApproval && (
                    <span className="flex items-center gap-1.5 text-yellow-300 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Action Required
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* â"€â"€ Issue details + TSO Window (6 cols) â"€â"€ */}
            <section className="lg:col-span-5 space-y-6">
              {/* Header */}
              {/* JIRA Issue card */}
              {jiraData && (
                <div className="glass rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-white">{jiraData.key}</span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
                          {typeof jiraData.fields.issuetype === 'string' ? jiraData.fields.issuetype : jiraData.fields.issuetype.name}
                        </span>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-sm rounded-full">
                          {typeof jiraData.fields.status === 'string' ? jiraData.fields.status : jiraData.fields.status.name}
                        </span>
                      </div>
                      <h2 className="text-xl text-white">{jiraData.fields.summary}</h2>
                    </div>
                    <a href={`https://jsw.ibm.com/browse/${jiraData.key}`} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-300 hover:text-blue-200 flex items-center gap-1 shrink-0">
                      Open in Jira <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Reporter</p>
                      <p className="text-white">
                        {typeof jiraData.fields.reporter === 'string' ? jiraData.fields.reporter : jiraData.fields.reporter?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Assignee</p>
                      <p className="text-white">
                        {typeof jiraData.fields.assignee === 'string' ? jiraData.fields.assignee : jiraData.fields.assignee?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Updated</p>
                      <p className="text-white">{new Date(jiraData.fields.updated).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TSO Execution Window */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">TSO Execution Window</h3>
                  <span className={`px-3 py-1 text-xs rounded-full ${
                    jobState.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                    jobState.status === 'failed' || jobState.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                    jobState.status === 'running' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {jobState.status}
                  </span>
                </div>

                {/* Analysis summary bar */}
                {aiAnalysis && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                      <p className="text-[11px] text-blue-300">INTENT</p>
                      <p className="text-sm text-white mt-1">{aiAnalysis.intent}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded">
                      <p className="text-[11px] text-emerald-300">REGION</p>
                      <p className="text-sm text-white mt-1">{aiAnalysis.region || 'Not specified'}</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                      <p className="text-[11px] text-purple-300">CONFIDENCE</p>
                      <p className="text-sm text-white mt-1">{aiAnalysis.confidence}%</p>
                    </div>
                  </div>
                )}

                {/* Claims to be changed */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg mb-4">
                  <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-slate-700">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Claims to be Changed</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {jobState.returnCode !== null ? `RC=${jobState.returnCode}` : 'Pending execution'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const text = (aiAnalysis?.claims || []).join('\n');
                        navigator.clipboard.writeText(text).then(() => {
                          setClaimsCopied(true);
                          setTimeout(() => setClaimsCopied(false), 2000);
                        });
                      }}
                      title="Copy claims to clipboard"
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    >
                      {claimsCopied ? <ClipboardCheck className="w-4 h-4 text-green-400" /> : <Clipboard className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto p-3">
                    {aiAnalysis && (aiAnalysis.claims || []).length > 0 ? (
                      <ul className="space-y-1.5">
                        {(aiAnalysis.claims || []).map((claim, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                            <span className="text-slate-200 font-mono">{claim}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No claims extracted</p>
                    )}
                  </div>
                </div>

                {/* JCL Window */}
                {jclContent && (
                  <div className="glass rounded-xl p-6 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">JCL Window</h3>
                        {jobState.jobId && jobState.jobName && (
                          <>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={handleOpenSpoolViewer}
                              className="text-cyan-400 hover:text-cyan-300 underline decoration-dotted hover:decoration-solid transition-colors text-sm font-mono"
                              title="Click to view spool files"
                            >
                              {jobState.jobName}/{jobState.jobId}
                            </button>
                            {jobState.returnCode !== null && (
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                jobState.returnCode === 0
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                CC {jobState.returnCode}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!isJclEditing ? (
                          <button
                            onClick={() => {
                              jclBeforeEditRef.current = jclContent;
                              setIsJclEditing(true);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setJclContent(jclBeforeEditRef.current);
                                setIsJclEditing(false);
                              }}
                              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                            >
                              Revert
                            </button>
                            <button
                              onClick={() => setIsJclEditing(false)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                            >
                              Done
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                      {isJclEditing ? (
                        <textarea
                          value={jclContent}
                          onChange={(e) => setJclContent(e.target.value)}
                          className="w-full h-96 bg-transparent text-slate-200 resize-none focus:outline-none"
                          spellCheck={false}
                        />
                      ) : (
                        <div className="space-y-0.5">
                          {jclContent.split('\n').map((line, idx) => (
                            <div key={idx} className="flex">
                              <span className="text-slate-600 select-none mr-4 text-right" style={{ minWidth: '3ch' }}>
                                {idx + 1}
                              </span>
                              <span className="flex-1">{highlightJclLine(line)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {jobState.error && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/40 rounded text-red-300 text-sm">
                    {jobState.error}
                  </div>
                )}

                {/* AI Error Analysis */}
                {stepErrorAnalysis && (
                  <div className="mt-3 border border-red-500/40 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 border-b border-red-500/30">
                      <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-200">Step Failed: "{stepErrorAnalysis.step}"</p>
                        <p className="text-xs text-red-400 font-mono mt-0.5">{stepErrorAnalysis.error}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/60 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">What happened</p>
                        <p className="text-sm text-slate-200">{stepErrorAnalysis.explanation}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Suggested actions</p>
                        <ul className="space-y-1.5">
                          {stepErrorAnalysis.suggestions.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="mt-0.5 shrink-0 text-yellow-400">→</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* â”€â”€ Right sidebar (4 cols): JIRA + HiL status + Console â”€â”€ */}
            <aside className="lg:col-span-4 space-y-6">

              {/* JIRA Integration */}
              <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <h3 className="text-base font-semibold text-white">JIRA Integration</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fetchBTPIssues} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">
                      <RefreshCw className={`w-4 h-4 ${isBtpLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="p-1.5 bg-slate-700 text-slate-300 rounded">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {btpIssues.map((issue) => (
                    <div key={issue.key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-blue-300 font-semibold">{issue.key}</span>
                        <span className="text-xs text-slate-300">{issue.fields.status.name}</span>
                      </div>
                      <p className="text-sm text-white line-clamp-2">{issue.fields.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Console */}
              {systemConsolePanel}
            </aside>
          </div>
        )}
      </main>

      {/* ── Job Spool Viewer Modal ─────────────────────────────────────────────── */}
      {spoolViewerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSpoolViewerOpen(false)}
        >
          <div
            className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-white font-semibold">Job Spool Viewer</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {jobState.jobName} / {jobState.jobId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {jobState.returnCode !== null && (
                  <span className={`px-3 py-1 text-sm font-mono font-bold rounded ${
                    jobState.returnCode === 0
                      ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    RC = {jobState.returnCode}
                  </span>
                )}
                <button
                  onClick={() => setSpoolViewerOpen(false)}
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            {!isLoadingSpool && spoolFiles.length > 0 && (
              <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto shrink-0">
                {spoolFiles.map((file) => {
                  const key = file.ddname || file.id;
                  const isLoaded = Boolean(spoolFileContents[key]);
                  return (
                    <button
                      key={file.id}
                      onClick={() => setSelectedSpoolDd(key)}
                      className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                        selectedSpoolDd === key
                          ? 'border-cyan-500 text-cyan-300 bg-slate-800'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                      }`}
                    >
                      {file.ddname || file.id}
                      {isLoaded ? (
                        <span className="text-[9px] text-slate-500">{file.linesCount}</span>
                      ) : (
                        <RefreshCw className="w-2.5 h-2.5 text-slate-600 animate-spin" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Spool content */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 font-mono text-xs min-h-0">
              {isLoadingSpool ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading spool data…
                </div>
              ) : spoolFiles.length === 0 ? (
                <p className="text-slate-500 italic">No spool files available for this job yet. The job may still be running.</p>
              ) : selectedSpoolDd && spoolFileContents[selectedSpoolDd] ? (
                spoolFileContents[selectedSpoolDd].map((line, idx) => (
                  <div key={idx} className="leading-5 text-green-200 whitespace-pre">
                    {line}
                  </div>
                ))
              ) : selectedSpoolDd ? (
                <div className="flex items-center text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading {selectedSpoolDd}…
                </div>
              ) : (
                <p className="text-slate-500 italic">Select a spool file tab above.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-700 shrink-0 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {spoolFiles.length} spool file{spoolFiles.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                {selectedSpoolDd && spoolFileContents[selectedSpoolDd]
                  ? `${spoolFileContents[selectedSpoolDd].length} lines`
                  : '—'}
              </p>
              {jobState.jobLink && (
                <a
                  href={jobState.jobLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in z/OSMF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
