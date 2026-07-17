import apiClient from '../../../api/client';

export interface AdminOrder {
  orderId: number;
  orderNumber: string;
  customerName: string;
  location: string;
  area: string;
  salesPersonName: string;
  salespersonRemark: string;
  priorityLevel: string;
  orderCreatedDate: string;
  timeSpan: string;
  billNo: string;
  paymentCleared: boolean;
  adminRemarks: string;
  status: string;
  onHold: boolean;
  totalAmount: number;
}

export interface AdminOrderDetails extends AdminOrder {
  address: string;
  orderDate: string;
  priority?: string;
  items: Array<{
    productName: string;
    size: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    totalPrice: number;
  }>;
}

export const adminAccountsApi = {
  getPendingPayments: async () => {
    const response = await apiClient.get<{ success: boolean; data: AdminOrder[] }>(
      '/admin-accounts/pending-payments'
    );
    return response.data.data;
  },

  getCancelledOrders: async () => {
    const response = await apiClient.get<{ success: boolean; data: AdminOrder[] }>(
      '/admin-accounts/cancelled-orders'
    );
    return response.data.data;
  },

  getOrderDetails: async (orderId: number) => {
    const response = await apiClient.get<{ success: boolean; data: AdminOrderDetails }>(
      `/admin-accounts/${orderId}`
    );
    return response.data.data;
  },

  acceptOrder: async (
    orderId: number,
    data: { billNo: string; paymentDate?: string; adminRemarks?: string }
  ) => {
    const response = await apiClient.post<{ success: boolean; data: AdminOrder; message: string }>(
      `/admin-accounts/${orderId}/accept`,
      data,
      { successMessage: 'Order accepted successfully' }
    );
    return response.data;
  },

  holdOrder: async (orderId: number, data: { holdReason: string }) => {
    const response = await apiClient.put<{ success: boolean; data: AdminOrder; message: string }>(
      `/admin-accounts/${orderId}/hold`,
      data,
      { successMessage: 'Order put on hold' }
    );
    return response.data;
  },

  rejectOrder: async (orderId: number, data: { rejectReason: string }) => {
    const response = await apiClient.put<{ success: boolean; data: AdminOrder; message: string }>(
      `/admin-accounts/${orderId}/reject`,
      data,
      { successMessage: 'Order rejected' }
    );
    return response.data;
  },

  updateBillNo: async (orderId: number, data: { billNo: string }) => {
    const response = await apiClient.put<{ success: boolean; data: AdminOrder; message: string }>(
      `/admin-accounts/${orderId}/bill-no`,
      data,
      { successMessage: 'Bill Number updated successfully' }
    );
    return response.data;
  },

  resumeOrder: async (orderId: number) => {
    const response = await apiClient.put<{ success: boolean; data: AdminOrder; message: string }>(
      `/admin-accounts/${orderId}/resume`,
      {},
      { successMessage: 'Order removed from hold' }
    );
    return response.data;
  },
};
