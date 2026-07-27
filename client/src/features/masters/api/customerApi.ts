import apiClient from '@/api/client';
import { decodeHtml } from '@/utils/stringUtils';
import { Customer } from '../types';

const API_PREFIX = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Customer plain-text fields that may hold legacy HTML-encoded values.
 * Records saved before the plain-text sanitisation fix can contain one or more
 * "&amp;" layers; decoding here means the table, the edit form and every
 * customer dropdown all receive the same plain-text value.
 *
 * Identifiers (CustomerID), numbers, dates and flags are never touched.
 */
const CUSTOMER_TEXT_FIELDS = [
  'CompanyName',
  'ContactPerson',
  'Address',
  'Location',
  'State',
  'Area',
  'City',
  'Notes',
] as const;

const normalizeCustomerText = <T>(customer: T): T => {
  if (!customer || typeof customer !== 'object') return customer;

  const result = { ...(customer as Record<string, unknown>) };
  for (const field of CUSTOMER_TEXT_FIELDS) {
    if (typeof result[field] === 'string') {
      result[field] = decodeHtml(result[field] as string);
    }
  }
  return result as T;
};

const normalizeCustomerList = (customers: unknown): Customer[] =>
  Array.isArray(customers) ? customers.map(c => normalizeCustomerText(c as Customer)) : [];

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const customerApi = {
  getAll: async (): Promise<ApiResponse<Customer[]>> => {
    try {
      const { data } = await apiClient.get(`${API_PREFIX}/masters/customers`);
      return { success: true, data: normalizeCustomerList(data.data ?? data) };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to load customers',
      };
    }
  },

  getActive: async (): Promise<ApiResponse<Customer[]>> => {
    try {
      const { data } = await apiClient.get(`${API_PREFIX}/masters/customers/active-list`);
      return { success: true, data: normalizeCustomerList(data.data ?? data) };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to load active customers',
      };
    }
  },

  getMyCustomers: async (): Promise<ApiResponse<Customer[]>> => {
    try {
      const { data } = await apiClient.get(`${API_PREFIX}/masters/customers/my-customers`);
      return { success: true, data: normalizeCustomerList(data.data ?? data) };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to load my customers',
      };
    }
  },

  create: async (customer: Omit<Customer, 'CustomerID'>): Promise<ApiResponse<Customer>> => {
    try {
      const { data } = await apiClient.post(`${API_PREFIX}/masters/customers`, customer);
      return { success: true, data: normalizeCustomerText<Customer>(data.data ?? data) };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to create customer',
      };
    }
  },

  update: async (id: number, customer: Customer): Promise<ApiResponse<Customer>> => {
    try {
      const { data } = await apiClient.put(`${API_PREFIX}/masters/customers/${id}`, customer);
      return { success: true, data: normalizeCustomerText<Customer>(data.data ?? data) };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to update customer',
      };
    }
  },

  delete: async (id: number): Promise<ApiResponse<void>> => {
    try {
      await apiClient.delete(`${API_PREFIX}/masters/customers/${id}`);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.response?.data?.error || err?.message || 'Failed to delete customer',
      };
    }
  },
};
