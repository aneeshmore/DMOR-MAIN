import apiClient from '@/api/client';
import { TestCertificate, CompletedBatch } from '../types/testCertificate.types';

export const testCertificateApi = {
  getAll: async (filters?: { search?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });
    }
    const response = await apiClient.get<{ success: boolean; data: TestCertificate[] }>(
      `/test-certificates?${params.toString()}`
    );
    return response.data.data;
  },

  getById: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: TestCertificate }>(
      `/test-certificates/${id}`
    );
    return response.data.data;
  },

  create: async (
    data: Omit<TestCertificate, 'id' | 'certificateNo' | 'status'> & { status?: string }
  ) => {
    const response = await apiClient.post<{ success: boolean; data: TestCertificate }>(
      '/test-certificates',
      data
    );
    return response.data.data;
  },

  update: async (id: number, data: Partial<TestCertificate>) => {
    const response = await apiClient.put<{ success: boolean; data: TestCertificate }>(
      `/test-certificates/${id}`,
      data
    );
    return response.data.data;
  },

  approve: async (id: number) => {
    const response = await apiClient.patch<{ success: boolean; data: TestCertificate }>(
      `/test-certificates/${id}/approve`
    );
    return response.data.data;
  },

  delete: async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/test-certificates/${id}`
    );
    return response.data;
  },

  getCompletedBatches: async () => {
    const response = await apiClient.get<{ success: boolean; data: CompletedBatch[] }>(
      '/test-certificates/completed-batches'
    );
    return response.data.data;
  },

  getCompletedBatchById: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: CompletedBatch }>(
      `/test-certificates/completed-batches/${id}`
    );
    return response.data.data;
  },
};
export default testCertificateApi;
