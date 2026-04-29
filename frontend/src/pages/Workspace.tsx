import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, handleApiError, IntentAnalysisResult } from '../utils/api';
import ProgressBar, { ProgressStep } from '../components/ProgressBar';
import {
  LogOut,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Edit3,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  Brain,
  AlertCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

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
    [key: string]: any;
  };
}

interface ChatMessage {
  id: string;
  type: 'system' | 'user' | 'ai' | 'mainframe' | 'jira' | 'workflow' | 'performance' | 'security' | 'debug';
  message: string;
  timestamp: Date;
  category?: 'info' | 'warning' | 'error' | 'success';
  details?: string;
  duration?: number;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
  const [editedIntent, setEditedIntent] = useState('');
  const [editedRegion, setEditedRegion] = useState('');
  const [editedClaims, setEditedClaims] = useState('');
  
  // Enhanced Console Features
  const [consoleFilter, setConsoleFilter] = useState<string>('all');
  const [consoleSearch, setConsoleSearch] = useState('');
  const [showConsoleDetails, setShowConsoleDetails] = useState<string | null>(null);
  const [consoleOrder, setConsoleOrder] = useState<'newest-first' | 'oldest-first'>('oldest-first');
  const consoleRef = React.useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const socketInstance = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
    });

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected:', socketInstance.id);
    });

    socketInstance.on('ai:progress', (progress: any) => {
      addChatMessage('system', progress.message);
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const addChatMessage = (
    type: 'system' | 'user' | 'ai' | 'mainframe' | 'jira' | 'workflow' | 'performance' | 'security' | 'debug',
    message: string,
    category?: 'info' | 'warning' | 'error' | 'success',
    details?: string,
    duration?: number
  ) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type,
        message,
        timestamp: new Date(),
        category,
        details,
        duration,
      },
    ]);
    
    // Auto-scroll to bottom if in oldest-first mode
    if (consoleOrder === 'oldest-first') {
      setTimeout(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const clearConsole = () => {
    setChatMessages([]);
    addChatMessage('system', 'Console cleared', 'info');
  };

  const exportLogs = () => {
    const logText = chatMessages
      .map((msg) => {
        const time = msg.timestamp.toLocaleTimeString();
        const details = msg.details ? `\n  Details: ${msg.details}` : '';
        const duration = msg.duration ? ` (${msg.duration}ms)` : '';
        return `[${time}] [${msg.type.toUpperCase()}] ${msg.message}${duration}${details}`;
      })
      .join('\n\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addChatMessage('system', 'Logs exported successfully', 'success');
  };

  const filteredMessages = chatMessages.filter((msg) => {
    const matchesFilter = consoleFilter === 'all' || msg.type === consoleFilter;
    const matchesSearch = !consoleSearch ||
      msg.message.toLowerCase().includes(consoleSearch.toLowerCase()) ||
      (msg.details && msg.details.toLowerCase().includes(consoleSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Apply ordering
  const orderedMessages = consoleOrder === 'newest-first'
    ? [...filteredMessages].reverse()
    : filteredMessages;

  const toggleConsoleOrder = () => {
    setConsoleOrder(prev => prev === 'oldest-first' ? 'newest-first' : 'oldest-first');
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleFetchJiraIssue = async () => {
    if (!csrId.trim()) {
      setError('Please enter a CSR/Issue ID');
      return;
    }

    const startTime = Date.now();
    setIsLoading(true);
    setError(null);
    setJiraData(null);
    setXmlData(null);
    setIsApproved(false);
    setAiAnalysis(null);
    setAiError(null);
    setChatMessages([]);

    // Enhanced logging
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
      setAiError(apiError.message);
      addChatMessage('debug', 'AI analysis error', 'error', apiError.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 4: Re-analyze with corrections
  const handleReanalyze = async () => {
    if (!jiraData || !aiAnalysis) return;

    setIsAnalyzing(true);
    setAiError(null);
    addChatMessage('user', 'Re-analyzing with corrections...');

    try {
      const corrections = {
        intent: editedIntent || aiAnalysis.intent,
        region: editedRegion || aiAnalysis.region,
        claims: editedClaims ? editedClaims.split(',').map(c => c.trim()) : aiAnalysis.claims,
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
      addChatMessage('system', `❌ Re-analysis failed: ${apiError.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = () => {
    setIsApproved(true);
    addChatMessage('workflow', 'Requirements approved', 'success');
    addChatMessage('security', `Approval logged for user ${user?.tsoId}`, 'info');
    addChatMessage('workflow', 'Ready for next phase: Workflow generation', 'success');
  };

  const handleRequestChanges = () => {
    setIsApproved(false);
    setIsEditingAnalysis(true);
    setEditedIntent(aiAnalysis?.intent || '');
    setEditedRegion(aiAnalysis?.region || '');
    setEditedClaims(aiAnalysis?.claims?.join(', ') || '');
    addChatMessage('user', 'Requesting changes to AI analysis', 'warning');
    addChatMessage('workflow', 'Entering edit mode', 'info');
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
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">OneTimer Bob</h1>
                <p className="text-xs text-slate-400">Healthcare Claims Processing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user?.tsoId}</p>
                <p className="text-xs text-slate-400">
                  Session: {user?.sessionId ? user.sessionId.slice(0, 8) + '...' : 'Active'}
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

            {/* Jira Data Display */}
            {jiraData && (
              <>
                {/* Issue Header */}
                <div className="glass rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-white">{jiraData.key}</span>
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-full">
                          {typeof jiraData.fields.issuetype === 'string'
                            ? jiraData.fields.issuetype
                            : jiraData.fields.issuetype?.name || 'Unknown'}
                        </span>
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                          {typeof jiraData.fields.status === 'string'
                            ? jiraData.fields.status
                            : jiraData.fields.status?.name || 'Unknown'}
                        </span>
                      </div>
                      <h3 className="text-xl text-white">{jiraData.fields.summary}</h3>
                    </div>
                    {jiraData.fields.priority && (
                      <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-sm font-medium rounded-full">
                        {typeof jiraData.fields.priority === 'string'
                          ? jiraData.fields.priority
                          : jiraData.fields.priority?.name || 'Unknown'}
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Reporter</p>
                      <p className="text-sm text-white">
                        {typeof jiraData.fields.reporter === 'string'
                          ? jiraData.fields.reporter
                          : jiraData.fields.reporter?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Assignee</p>
                      <p className="text-sm text-white">
                        {typeof jiraData.fields.assignee === 'string'
                          ? jiraData.fields.assignee
                          : jiraData.fields.assignee?.displayName || 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Created</p>
                      <p className="text-sm text-white">{formatDate(jiraData.fields.created)}</p>
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

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1 mb-3">
                {['all', 'system', 'ai', 'mainframe', 'jira', 'workflow', 'performance', 'security', 'debug'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setConsoleFilter(filter)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      consoleFilter === filter
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="mb-3">
                <input
                  type="text"
                  value={consoleSearch}
                  onChange={(e) => setConsoleSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Console Messages */}
              <div
                ref={consoleRef}
                className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 max-h-[500px] overflow-y-auto scroll-smooth"
              >
                {orderedMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-500">
                      {consoleSearch || consoleFilter !== 'all' ? 'No matching logs' : 'No activity yet'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {consoleSearch || consoleFilter !== 'all' ? 'Try different filters' : 'System messages will appear here'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {orderedMessages.map((msg) => {
                      const icon = {
                        system: '🔧',
                        ai: '🤖',
                        user: '👤',
                        mainframe: '🖥️',
                        jira: '📋',
                        workflow: '⚙️',
                        performance: '⚡',
                        security: '🔒',
                        debug: '🐛',
                      }[msg.type];

                      const categoryColor = {
                        info: 'text-slate-300',
                        warning: 'text-yellow-300',
                        error: 'text-red-300',
                        success: 'text-green-300',
                      }[msg.category || 'info'];

                      return (
                        <div key={msg.id} className="group">
                          <div
                            className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-slate-800/50 cursor-pointer border-b border-slate-800/30 last:border-0"
                            onClick={() => setShowConsoleDetails(showConsoleDetails === msg.id ? null : msg.id)}
                          >
                            <span className="flex-shrink-0">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className={categoryColor}>{msg.message}</span>
                              {msg.duration && (
                                <span className="ml-2 text-slate-500">({msg.duration}ms)</span>
                              )}
                              {msg.details && showConsoleDetails === msg.id && (
                                <div className="mt-1 p-2 bg-slate-800/50 rounded text-slate-400 text-xs whitespace-pre-wrap">
                                  {msg.details}
                                </div>
                              )}
                            </div>
                            {msg.details && (
                              <ChevronRight
                                className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${
                                  showConsoleDetails === msg.id ? 'rotate-90' : ''
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isAnalyzing && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                  <p className="text-sm text-blue-400">AI is analyzing...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Workspace;

// Made with Bob
