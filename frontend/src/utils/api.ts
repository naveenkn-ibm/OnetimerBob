import axios, { AxiosInstance, AxiosError } from 'axios';

// API base URL - uses Vite proxy in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for session management
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// API Types
export interface LoginRequest {
  tsoId: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    tsoId: string;
    sessionId: string;
  };
  message: string;
}

export interface JiraIssueRequest {
  issueKey: string;
}

export interface JiraIssueResponse {
  success: boolean;
  data: {
    key: string;
    fields: {
      summary: string;
      description: string;
      status: {
        name: string;
      };
      issuetype: {
        name: string;
      };
      priority?: {
        name: string;
      };
      assignee?: {
        displayName: string;
        emailAddress: string;
      };
      reporter?: {
        displayName: string;
        emailAddress: string;
      };
      created: string;
      updated: string;
      labels?: string[];
      [key: string]: any;
    };
  };
  xml?: string;
  message: string;
}

export interface IntentAnalysisResult {
  intent: string;
  region?: string;
  claims?: string[];
  entities: Record<string, any>;
  summary: string;
  confidence: number;
}

export interface AIAnalysisResponse {
  success: boolean;
  data: IntentAnalysisResult;
  validation: {
    valid: boolean;
    issues: string[];
    suggestions: string[];
  };
  message: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// API Methods
export const api = {
  // Authentication
  login: async (credentials: LoginRequest, socketId?: string): Promise<LoginResponse> => {
    const url = socketId ? `/auth/login?socketId=${socketId}` : '/auth/login';
    const response = await apiClient.post<LoginResponse>(url, credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  },

  validateSession: async (): Promise<{ valid: boolean }> => {
    const response = await apiClient.get('/auth/validate');
    return response.data;
  },

  // Jira Integration
  getJiraIssue: async (issueKey: string): Promise<JiraIssueResponse> => {
    const response = await apiClient.post<JiraIssueResponse>('/jira/issue', {
      issueKey,
    });
    return response.data;
  },

  // AI Analysis
  analyzeCSR: async (issueData: any, socketId?: string): Promise<AIAnalysisResponse> => {
    const response = await apiClient.post<AIAnalysisResponse>('/ai/analyze', {
      issueData,
      socketId,
    });
    return response.data;
  },

  reanalyzeCSR: async (
    issueData: any,
    corrections: {
      intent?: string;
      region?: string;
      claims?: string[];
      additionalContext?: string;
    },
    socketId?: string
  ): Promise<AIAnalysisResponse> => {
    const response = await apiClient.post<AIAnalysisResponse>('/ai/reanalyze', {
      issueData,
      corrections,
      socketId,
    });
    return response.data;
  },

  getAIStatus: async (): Promise<{ success: boolean; available: boolean; message: string }> => {
    const response = await apiClient.get('/ai/status');
    return response.data;
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// Error handler utility
export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    return {
      message: axiosError.response?.data?.message || axiosError.message || 'An error occurred',
      code: axiosError.code,
      details: axiosError.response?.data?.details,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'An unknown error occurred',
  };
};

export default apiClient;

// Made with Bob
