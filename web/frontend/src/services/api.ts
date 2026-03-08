import axios from 'axios';
import type { PublicClientApplication } from '@azure/msal-browser';
import type {
  MigrationDashboard,
  OperationSummary,
  RiskAssessmentRow,
  BucketComparisonRow,
  DomainBucketOverview,
  GPORow,
  PaginatedResponse,
  OperationsListResponse,
  HealthResponse,
  UploadedFile,
  GPODetails,
  MigrationDomainsResponse,
  MigrationSummaryData,
} from '../types';

// API base URL - use relative URLs to leverage nginx proxy
// All /api/* requests are proxied to backend:8000 via nginx.conf
const API_BASE_URL = '';

// MSAL instance for token acquisition (set by main.tsx)
let msalInstance: PublicClientApplication | null = null;

export const setMsalInstance = (instance: PublicClientApplication) => {
  msalInstance = instance;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    if (msalInstance) {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        try {
          // Get token silently (uses cache or refreshes)
          const response = await msalInstance.acquireTokenSilent({
            scopes: ['User.Read', 'openid', 'profile', 'email'],
            account: accounts[0],
          });
          config.headers.Authorization = `Bearer ${response.idToken}`;
        } catch (error) {
          console.error('Failed to acquire token silently:', error);
          // Token acquisition failed - will trigger 401 and redirect
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && msalInstance) {
      // Token expired or invalid - redirect to login
      try {
        await msalInstance.loginRedirect({
          scopes: ['User.Read', 'openid', 'profile', 'email'],
        });
      } catch (loginError) {
        console.error('Login redirect failed:', loginError);
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Health & Utility
// ============================================================================

export const getHealth = async (): Promise<HealthResponse> => {
  const response = await api.get('/api/health');
  return response.data;
};

export const refreshCache = async (): Promise<{ status: string; message: string; active_gpos: number }> => {
  const response = await api.post('/api/upload/refresh');
  return response.data;
};

// ============================================================================
// Executive Mode Endpoints
// ============================================================================

export const getExecutiveDashboard = async (): Promise<MigrationDashboard> => {
  const response = await api.get('/api/executive/dashboard');
  return response.data;
};

export const getOperationsSummary = async (): Promise<OperationSummary[]> => {
  const response = await api.get('/api/executive/operations-summary');
  return response.data;
};

export const getRiskAssessment = async (): Promise<RiskAssessmentRow[]> => {
  const response = await api.get('/api/executive/risk-assessment');
  return response.data;
};

export const getBucketComparison = async (): Promise<BucketComparisonRow[]> => {
  const response = await api.get('/api/executive/bucket-comparison');
  return response.data;
};

// ============================================================================
// Domain Mode Endpoints
// ============================================================================

export const getAvailableOperations = async (): Promise<OperationsListResponse> => {
  const response = await api.get('/api/domain/operations');
  return response.data;
};

export const getDomainOverview = async (operationCode: string): Promise<DomainBucketOverview> => {
  const response = await api.get(`/api/domain/${operationCode}/overview`);
  return response.data;
};

export const getServerGpos = async (
  operationCode: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<GPORow>> => {
  const response = await api.get(`/api/domain/${operationCode}/server-gpos`, {
    params: { page, limit },
  });
  return response.data;
};

export const getWorkstationGpos = async (
  operationCode: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<GPORow>> => {
  const response = await api.get(`/api/domain/${operationCode}/workstation-gpos`, {
    params: { page, limit },
  });
  return response.data;
};

export const getUserGpos = async (
  operationCode: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<GPORow>> => {
  const response = await api.get(`/api/domain/${operationCode}/user-gpos`, {
    params: { page, limit },
  });
  return response.data;
};

export const getReviewRequired = async (
  operationCode: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<GPORow>> => {
  const response = await api.get(`/api/domain/${operationCode}/review-required`, {
    params: { page, limit },
  });
  return response.data;
};

export const getGpoDetails = async (
  operationCode: string,
  gpoName: string
): Promise<GPODetails> => {
  const response = await api.get(
    `/api/domain/${operationCode}/gpo/${encodeURIComponent(gpoName)}/details`
  );
  return response.data;
};

// ============================================================================
// File Management
// ============================================================================

export const uploadHtmlFile = async (file: File): Promise<{ filename: string; domain_detected: string; message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/api/upload/html', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const uploadMultipleFiles = async (files: File[]): Promise<{ total_files: number; successful: number; results: unknown[]; message: string }> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  const response = await api.post('/api/upload/html/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getUploadedFiles = async (): Promise<{ files: UploadedFile[]; count: number }> => {
  const response = await api.get('/api/upload/files');
  return response.data;
};

export const deleteFile = async (filename: string): Promise<{ message: string }> => {
  const response = await api.delete(`/api/upload/files/${filename}`);
  return response.data;
};

// ============================================================================
// Export
// ============================================================================

/**
 * Helper function to download a file using axios (includes auth token)
 * and trigger browser download
 */
const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    });
    
    // Create blob URL and trigger download
    const blob = new Blob([response.data]);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};

export const downloadExecutiveExcel = async (): Promise<void> => {
  await downloadFile('/api/export/executive', 'executive_report.xlsx');
};

export const downloadDomainExcel = async (operationCode: string): Promise<void> => {
  await downloadFile(`/api/export/domain/${operationCode}`, `domain_report_${operationCode}.xlsx`);
};

// ============================================================================
// Migration Mode Endpoints
// ============================================================================

export const getMigrationDomains = async (): Promise<MigrationDomainsResponse> => {
  const response = await api.get('/api/migration/domains');
  return response.data;
};

export const getMigrationSummary = async (domain: string): Promise<MigrationSummaryData> => {
  const response = await api.get(`/api/migration/${encodeURIComponent(domain)}/summary`);
  return response.data;
};

export const downloadMigrationExcel = async (domain: string): Promise<void> => {
  await downloadFile(`/api/migration/${encodeURIComponent(domain)}/export`, `migration_report_${domain}.xlsx`);
};


// ============================================================================
// CLI Commands Endpoints
// ============================================================================

interface CommandResponse {
  success: boolean;
  output: string;
  download_url?: string | null;
  filename?: string | null;
  execution_time_seconds?: number | null;
  error?: string | null;
}

interface DomainOption {
  value: string;
  label: string;
}

interface DomainsResponse {
  domains: DomainOption[];
}

export const getCLIDomains = async (): Promise<DomainsResponse> => {
  const response = await api.get('/api/commands/domains');
  return response.data;
};

export const runImpactReport = async (domain: string): Promise<CommandResponse> => {
  const response = await api.post('/api/commands/impact', { domain });
  return response.data;
};

export const runFullReport = async (): Promise<CommandResponse> => {
  const response = await api.post('/api/commands/full');
  return response.data;
};

/**
 * Download a CLI-generated file using authenticated request.
 * Uses the same pattern as other Excel exports to ensure auth token is included.
 */
export const downloadCLIFile = async (downloadUrl: string, filename: string): Promise<void> => {
  await downloadFile(downloadUrl, filename);
};

export default api;
