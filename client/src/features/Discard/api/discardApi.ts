import apiClient from '../../../api/client';
import { DiscardEntry, CreateDiscardInput, UpdateDiscardInput } from '../types';

export const discardApi = {
  getAllDiscards: async (filters?: { productId?: number; productType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.productId) params.append('productId', String(filters.productId));
    if (filters?.productType && filters.productType !== 'ALL') {
      params.append('productType', filters.productType);
    }

    const response = await apiClient.get<{ success: boolean; data: DiscardEntry[] }>(
      `/discard?${params.toString()}`
    );
    return response.data.data;
  },

  getDiscardById: async (discardId: number) => {
    const response = await apiClient.get<{ success: boolean; data: DiscardEntry }>(
      `/discard/${discardId}`
    );
    return response.data.data;
  },

  createDiscard: async (data: CreateDiscardInput) => {
    const response = await apiClient.post<{ success: boolean; data: DiscardEntry }>(
      '/discard',
      data
    );
    return response.data.data;
  },

  updateDiscard: async (discardId: number, data: UpdateDiscardInput) => {
    const response = await apiClient.put<{ success: boolean; data: DiscardEntry }>(
      `/discard/${discardId}`,
      data
    );
    return response.data.data;
  },

  deleteDiscard: async (discardId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/discard/${discardId}`
    );
    return response.data;
  },
};
