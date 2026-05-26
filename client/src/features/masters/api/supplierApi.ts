import apiClient from '@/api/client';
import { Supplier } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const supplierApi = {
  getAll: async (): Promise<ApiResponse<Supplier[]>> => {
    try {
      const { data } = await apiClient.get('/suppliers?isActive=true');
      return { success: true, data: data.data ?? data };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to load suppliers',
      };
    }
  },

  create: async (supplier: Omit<Supplier, 'supplierId'>): Promise<ApiResponse<Supplier>> => {
    try {
      const { data } = await apiClient.post('/suppliers', supplier);
      return { success: true, data: data.data ?? data };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to create supplier',
      };
    }
  },

  update: async (id: number, supplier: Partial<Supplier>): Promise<ApiResponse<Supplier>> => {
    try {
      const { data } = await apiClient.put(`/suppliers/${id}`, supplier);
      return { success: true, data: data.data ?? data };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update supplier',
      };
    }
  },

  delete: async (id: number): Promise<ApiResponse<void>> => {
    try {
      await apiClient.delete(`/suppliers/${id}`);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || err?.data?.message || 'Failed to delete supplier',
      };
    }
  },
};
