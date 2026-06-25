import apiClient from '@/api/client';
import { FieldIntelligenceReport, DashboardSummary } from '../types/fieldIntelligence.types';

export const fieldIntelligenceApi = {
  getAll: async (filters?: {
    status?: string;
    executiveId?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          params.append(key, String(val));
        }
      });
    }
    const response = await apiClient.get<{ success: boolean; data: FieldIntelligenceReport[] }>(
      `/field-intelligence?${params.toString()}`
    );
    return response.data.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get<{ success: boolean; data: FieldIntelligenceReport }>(
      `/field-intelligence/${id}`
    );
    return response.data.data;
  },

  create: async (reportData: FieldIntelligenceReport) => {
    const response = await apiClient.post<{ success: boolean; data: FieldIntelligenceReport }>(
      '/field-intelligence',
      reportData,
      { skipErrorToast: true }
    );
    return response.data.data;
  },

  update: async (id: string, reportData: Partial<FieldIntelligenceReport>) => {
    const response = await apiClient.patch<{ success: boolean; data: FieldIntelligenceReport }>(
      `/field-intelligence/${id}`,
      reportData,
      { skipErrorToast: true }
    );
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/field-intelligence/${id}`
    );
    return response.data;
  },

  getDashboardSummary: async () => {
    const response = await apiClient.get<{ success: boolean; data: DashboardSummary }>(
      '/field-intelligence/dashboard'
    );
    return response.data.data;
  },

  uploadFile: async (
    id: string,
    fileData: {
      fileType: string;
      fileName: string;
      filePath: string;
      fileSize?: number;
      mimeType?: string;
    }
  ) => {
    const response = await apiClient.post<{ success: boolean; data: any }>(
      `/field-intelligence/${id}/upload`,
      fileData
    );
    return response.data.data;
  },

  exportCsv: async () => {
    const response = await apiClient.get('/field-intelligence/export', {
      responseType: 'blob',
    });
    return response.data;
  },

  // ── Customer Intelligence ─────────────────────────────────────────────────

  getCustomerSummary: async (filters?: { search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    const response = await apiClient.get<{
      success: boolean;
      data: { linked: any[]; unlinked: any[] };
    }>(`/field-intelligence/customer-summary?${params.toString()}`);
    return response.data.data;
  },

  getCustomerHistory: async (customerId: number) => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(
      `/field-intelligence/customer/${customerId}/history`
    );
    return response.data.data;
  },

  getCustomerDashboard: async (customerId: number) => {
    const response = await apiClient.get<{ success: boolean; data: any }>(
      `/field-intelligence/customer/${customerId}/dashboard`
    );
    return response.data.data;
  },

  getCustomerUnlinkedHistory: async (customerName: string) => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(
      `/field-intelligence/customer-unlinked-history?customerName=${encodeURIComponent(customerName)}`
    );
    return response.data.data;
  },

  linkCustomer: async (payload: { customerId: number; customerName: string }) => {
    const response = await apiClient.post<{
      success: boolean;
      customerId: number;
      updatedCount: number;
    }>('/field-intelligence/link-customer', payload);
    return response.data;
  },
};
