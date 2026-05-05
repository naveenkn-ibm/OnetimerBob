import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  LogOut,
  Search,
  FileText,
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

const Workspace: React.FC = () => {
  const { user, logout } = useAuth();

  const [csrId, setCsrId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jiraData, setJiraData] = useState<JiraData | null>(null);
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));
  const [progress, setProgress] = useState<ProgressStep | null>(null);
  
  // Step 4: AI Analysis State
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
  const [showConsoleDetails, setShowConsoleDetails] = useState<string | null>(null);
  const [consoleOrder, setConsoleOrder] = useState<'newest-first' | 'oldest-first'>('oldest-first');
  const consoleRef = React.useRef<HTMLDivElement>(null);

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
    setJiraData(null);
    setXmlData(null);
    setIsApproved(false);
    setAiAnalysis(null);
    setAiError(null);
    setChatMessages([]);
    setJiraData(null);
    setAiAnalysis(null);
    resetExecutionState();
    setWorkflowStepStatus('Pull Claims JCL', 'in-progress');

    addChatMessage('security', `User ${user?.tsoId} initiated issue fetch`, 'info');
    addChatMessage('jira', `Connecting to Jira MCP server for issue: ${csrId.trim()}`, 'info');

    // Simulate progress steps
    const steps = [
      'Connecting to Jira via MCP...',
      'Authenticating...',
      'Fetching issue details...',
      'Parsing response...',
      'Rendering XML...',
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setProgress({
          step: i + 1,
          totalSteps: steps.length,
          message: steps[i],
          status: 'in-progress',
        });
        addChatMessage('workflow', steps[i], 'info');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const fetchStart = Date.now();
      const response = await api.getJiraIssue(csrId.trim());
      const fetchDuration = Date.now() - fetchStart;

      if (response.success) {
        console.log('🔍 Raw API Response:', response);
        setJiraData(response.data);
        setXmlData(response.xml || null);
        
        addChatMessage('performance', `API response received`, 'success', `Response time: ${fetchDuration}ms`, fetchDuration);
        addChatMessage('jira', `Issue ${csrId.trim()} fetched successfully`, 'success',
          `Status: ${typeof response.data.fields.status === 'string' ? response.data.fields.status : response.data.fields.status?.name}`);
        
        setProgress({
          step: steps.length,
          totalSteps: steps.length,
          message: 'Successfully retrieved issue details',
          status: 'completed',
        });

        // Step 4: Automatically trigger AI analysis
        await handleAIAnalysis(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch issue');
      }
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
      addChatMessage('debug', 'Error details', 'error', apiError.message);
      setProgress({
        step: 0,
        totalSteps: steps.length,
        message: apiError.message,
        status: 'error',
      });
    } finally {
      const totalDuration = Date.now() - startTime;
      addChatMessage('performance', `Total operation time: ${totalDuration}ms`, 'info', undefined, totalDuration);
      setIsLoading(false);
    }
  };

  // Step 4: AI Analysis Handler
  const handleAIAnalysis = async (issueData: JiraData) => {
    const startTime = Date.now();
    setIsAnalyzing(true);
    setAiError(null);
    
    addChatMessage('workflow', 'Initiating AI analysis workflow', 'info');
    addChatMessage('ai', 'Sending CSR content to OpenAI GPT-4o-mini', 'info');
    addChatMessage('security', 'Encrypting sensitive data before transmission', 'info');

    try {
      const response = await api.analyzeCSR(issueData, socket?.id);
      const duration = Date.now() - startTime;

      if (response.success) {
        setAiAnalysis(response.data);
        
        addChatMessage('performance', `AI analysis completed`, 'success', `Processing time: ${duration}ms`, duration);
        addChatMessage('ai', `Intent identified: "${response.data.intent}"`, 'success',
          `Confidence: ${response.data.confidence}%`);
        
        if (response.data.claims && response.data.claims.length > 0) {
          addChatMessage('ai', `Extracted ${response.data.claims.length} claim(s)`, 'success',
            `Region: ${response.data.region || 'unspecified'}\nClaims: ${response.data.claims.join(', ')}`);
        }

        if (!response.validation.valid) {
          addChatMessage('workflow', `Validation issues detected`, 'warning',
            response.validation.issues.join('\n'));
        } else {
          addChatMessage('workflow', 'All validations passed', 'success');
        }
      } else {
        throw new Error(response.message || 'AI analysis failed');
      }
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

      const response = await api.reanalyzeCSR(jiraData, corrections, socket?.id);

      if (response.success) {
        setAiAnalysis(response.data);
        setIsEditingAnalysis(false);
        addChatMessage('ai', 'Re-analysis complete with your corrections.');
      } else {
        throw new Error(response.message || 'Re-analysis failed');
      }
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

  const handleCopyXml = () => {
    if (xmlData) {
      navigator.clipboard.writeText(xmlData);
      addChatMessage('system', 'XML copied to clipboard', 'success');
      addChatMessage('security', 'Data copied to clipboard', 'info');
    }
  };

  const handleDownloadXml = () => {
    if (xmlData && jiraData) {
      const blob = new Blob([xmlData], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jiraData.key}_requirements.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addChatMessage('system', `XML file downloaded: ${jiraData.key}_requirements.xml`, 'success');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownloadAttachment = (attachment: any) => {
    try {
      // Decode base64 content
      const binaryString = atob(attachment.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
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
      addChatMessage('system', `Attachment downloaded: ${attachment.filename}`, 'success');
    } catch (error) {
      addChatMessage('system', `Failed to download attachment: ${error}`, 'error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* CSR Input Section */}
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Enter CSR / Issue ID</h2>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={csrId}
                    onChange={(e) => setCsrId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFetchJiraIssue()}
                    placeholder="e.g., PROJ-123, BTP-2"
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  onClick={handleFetchJiraIssue}
                  disabled={isLoading || !csrId.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Fetch & Analyze
                </button>
              </div>

              {/* Progress Bar */}
              {isLoading && progress && (
                <div className="mt-6">
                  <ProgressBar progress={progress} />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Error</p>
                    <p className="text-sm text-red-300 mt-1">{error}</p>
                  </div>
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

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
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
                      <p className="text-xs text-slate-400 mb-1">Jira Link</p>
                      <a
                        href={`https://jsw.ibm.com/browse/${jiraData.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 underline"
                      >
                        {jiraData.key}
                      </a>
                    </div>
                    <div>
                      <p className="text-slate-400">Updated</p>
                      <p className="text-white">{new Date(jiraData.fields.updated).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Updated</p>
                      <p className="text-sm text-white">{formatDate(jiraData.fields.updated)}</p>
                    </div>
                  </div>

                  {/* Labels */}
                  {jiraData.fields.labels && jiraData.fields.labels.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">Labels</p>
                      <div className="flex flex-wrap gap-2">
                        {jiraData.fields.labels.map((label, index) => (
                          <span
                            key={typeof label === 'string' ? label : `label-${index}`}
                            className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded"
                          >
                            {typeof label === 'string' ? label : (label as any)?.name || String(label)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {jiraData.fields.attachment && jiraData.fields.attachment.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-400 mb-2">Attachments ({jiraData.fields.attachment.length})</p>
                      <div className="space-y-2">
                        {jiraData.fields.attachment.map((attachment, index) => (
                          <div
                            key={attachment.id || `attachment-${index}`}
                            className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-750 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">
                                  {attachment.filename}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <span>{formatFileSize(attachment.size)}</span>
                                  {attachment.author && (
                                    <>
                                      <span>•</span>
                                      <span>{attachment.author.displayName}</span>
                                    </>
                                  )}
                                  {attachment.created && (
                                    <>
                                      <span>•</span>
                                      <span>{formatDate(attachment.created)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadAttachment(attachment)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0"
                              title={`Download ${attachment.filename}`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* XML Display */}
                {xmlData && (
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Structured Requirements (XML)</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyXml}
                          className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          title="Copy XML"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleDownloadXml}
                          className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          title="Download XML"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto max-h-96">
                      <pre className="text-sm text-green-400 font-mono">{xmlData}</pre>
                    </div>
                  </div>
                )}

                {/* AI Analysis Results */}
                {aiAnalysis && (
                  <div className="glass rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Brain className="w-6 h-6 text-purple-400" />
                        <h3 className="text-lg font-semibold text-white">AI Analysis Results</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          aiAnalysis.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                          aiAnalysis.confidence >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {aiAnalysis.confidence}% Confidence
                        </span>
                        {!isEditingAnalysis && (
                          <button
                            onClick={() => {
                              setIsEditingAnalysis(true);
                              setEditedIntent(aiAnalysis.intent);
                              setEditedRegion(aiAnalysis.region || '');
                              setEditedClaims(aiAnalysis.claims?.join(', ') || '');
                            }}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Edit Analysis"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="mb-4 p-4 bg-slate-800 rounded-lg">
                      <p className="text-sm text-slate-300">{aiAnalysis.summary}</p>
                    </div>

                    {/* Structured Data */}
                    <div className="space-y-3">
                      {/* Intent */}
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-400 font-medium mb-1">INTENT</p>
                        {isEditingAnalysis ? (
                          <input
                            type="text"
                            value={editedIntent}
                            onChange={(e) => setEditedIntent(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                          />
                        ) : (
                          <p className="text-white font-semibold">{aiAnalysis.intent}</p>
                        )}
                      </div>

                      {/* Region */}
                      {aiAnalysis.region && (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-xs text-green-400 font-medium mb-1">REGION</p>
                          {isEditingAnalysis ? (
                            <input
                              type="text"
                              value={editedRegion}
                              onChange={(e) => setEditedRegion(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                            />
                          ) : (
                            <p className="text-white font-semibold">{aiAnalysis.region}</p>
                          )}
                        </div>
                      )}

                      {/* Claims */}
                      {aiAnalysis.claims && aiAnalysis.claims.length > 0 && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                          <p className="text-xs text-purple-400 font-medium mb-2">CLAIMS ({aiAnalysis.claims.length})</p>
                          {isEditingAnalysis ? (
                            <textarea
                              value={editedClaims}
                              onChange={(e) => setEditedClaims(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm font-mono"
                              placeholder="Enter claims separated by commas"
                            />
                          ) : (
                            <div className="space-y-1">
                              {aiAnalysis.claims.map((claim, index) => (
                                <p key={index} className="text-white font-mono text-sm">
                                  {claim}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Edit Actions */}
                      {isEditingAnalysis && (
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={handleReanalyze}
                            disabled={isAnalyzing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                            Re-analyze with Corrections
                          </button>
                          <button
                            onClick={() => setIsEditingAnalysis(false)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* AI Error */}
                    {aiError && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{aiError}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Section */}
                {aiAnalysis && !isApproved && (
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Review & Approval</h3>
                    <p className="text-slate-300 mb-6">
                      Please review the AI analysis and extracted data. Confirm if everything is accurate or
                      request changes.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approve Analysis
                      </button>
                      <button
                        onClick={handleRequestChanges}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        <Edit3 className="w-5 h-5" />
                        Request Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Approved Status */}
                {isApproved && (
                  <div className="glass rounded-xl p-6 border-2 border-green-500/50">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Analysis Approved</h3>
                        <p className="text-sm text-slate-400">
                          The AI analysis and requirements have been approved and are ready for the next phase.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-green-500/10 rounded-lg">
                      <p className="text-sm text-green-400">
                        ✓ Requirements approved and locked
                        <br />✓ AI analysis validated
                        <br />✓ Ready to proceed to workflow generation
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!jiraData && !isLoading && !error && (
              <div className="glass rounded-xl p-12 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Issue Loaded</h3>
                <p className="text-slate-400">
                  Enter a CSR or Issue ID above to fetch requirements and perform AI analysis
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Enhanced Console */}
          <div className="lg:col-span-1">
            <div className="glass rounded-xl p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">System Console</h3>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                    {filteredMessages.length}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggleConsoleOrder}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    title={consoleOrder === 'oldest-first' ? 'Switch to Newest First' : 'Switch to Oldest First'}
                  >
                    {consoleOrder === 'oldest-first' ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
                    )}
                  </button>
                  <button
                    onClick={exportLogs}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    title="Export Logs"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={clearConsole}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    title="Clear Console"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
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
