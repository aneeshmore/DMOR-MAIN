import apiClient from '../../../api/client';

export interface PurchaseOrderItem {
  itemId?: number;
  purchaseOrderId?: number;
  itemDescription: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice?: number;
  gst?: number | null;
}

export interface PurchaseOrder {
  purchaseOrderId: number;
  poNumber: string;
  supplierId: number;
  supplierName?: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  status: 'Pending' | 'Confirmed' | 'Received' | 'Partially Received' | 'Cancelled';
  totalAmount: number;
  notes?: string | null;
  deliveryAddress?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderInput {
  supplierId: number;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  status?: PurchaseOrder['status'];
  notes?: string | null;
  deliveryAddress?: string | null;
  items: Omit<PurchaseOrderItem, 'itemId' | 'purchaseOrderId' | 'totalPrice'>[];
}

export const purchaseOrdersApi = {
  getAll: async (limit = 50, offset = 0, status?: string) => {
    let query = `/purchase-orders?limit=${limit}&offset=${offset}`;
    if (status) query += `&status=${status}`;
    const response = await apiClient.get<{ success: boolean; data: PurchaseOrder[] }>(query);
    return response.data.data;
  },

  getById: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: PurchaseOrderWithItems }>(
      `/purchase-orders/${id}`
    );
    return response.data.data;
  },

  create: async (data: CreatePurchaseOrderInput) => {
    const response = await apiClient.post<{ success: boolean; data: PurchaseOrderWithItems }>(
      '/purchase-orders',
      data
    );
    return response.data.data;
  },

  update: async (id: number, data: Partial<CreatePurchaseOrderInput>) => {
    const response = await apiClient.put<{ success: boolean; data: PurchaseOrderWithItems }>(
      `/purchase-orders/${id}`,
      data
    );
    return response.data.data;
  },

  delete: async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/purchase-orders/${id}`
    );
    return response.data;
  },
};
