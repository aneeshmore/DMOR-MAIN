import apiClient from '../../../api/client';

export interface InwardFromPoItem {
  itemId: number;
  inwardPoId: number;
  purchaseOrderItemId?: number | null;
  masterProductId?: number | null;
  productId?: number | null;
  unitId?: number | null;
  itemDescription: string;
  receivedQuantity: string;
  unit?: string | null;
  unitPrice: string;
  totalCost: string;
  createdAt: string;
  updatedAt: string;
}

export interface InwardFromPo {
  inwardPoId: number;
  purchaseOrderId: number;
  poNumber?: string;
  supplierId: number;
  supplierName?: string;
  billNo?: string | null;
  inwardDate: string;
  notes?: string | null;
  totalCost: string;
  createdAt: string;
  updatedAt: string;
}

export interface InwardFromPoWithItems extends InwardFromPo {
  items: InwardFromPoItem[];
}

export interface CreateInwardFromPoInput {
  purchaseOrderId: number;
  supplierId: number;
  billNo?: string;
  inwardDate?: string;
  notes?: string;
  items: {
    purchaseOrderItemId?: number;
    itemDescription: string;
    receivedQuantity: number;
    unit?: string;
    unitPrice: number;
    totalCost: number;
    masterProductId?: number;
    productId?: number;
    unitId?: number;
  }[];
}

export const inwardFromPoApi = {
  getAll: async (limit = 50, offset = 0) => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(
      `/inward-from-po?limit=${limit}&offset=${offset}`
    );
    const list = response.data?.data || [];
    return list.map((item: any) => ({
      inwardPoId: item.inwardPoId ?? item.inward_po_id,
      purchaseOrderId: item.purchaseOrderId ?? item.purchase_order_id,
      poNumber: item.poNumber ?? item.po_number,
      supplierId: item.supplierId ?? item.supplier_id,
      supplierName: item.supplierName ?? item.supplier_name,
      billNo: item.billNo ?? item.bill_no,
      inwardDate: item.inwardDate ?? item.inward_date,
      notes: item.notes,
      totalCost: item.totalCost ?? item.total_cost,
      createdAt: item.createdAt ?? item.created_at,
      updatedAt: item.updatedAt ?? item.updated_at,
    })) as InwardFromPo[];
  },

  getById: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: any }>(`/inward-from-po/${id}`);
    const item = response.data?.data;
    if (!item) throw new Error('Data not found');
    return {
      inwardPoId: item.inwardPoId ?? item.inward_po_id,
      purchaseOrderId: item.purchaseOrderId ?? item.purchase_order_id,
      poNumber: item.poNumber ?? item.po_number,
      supplierId: item.supplierId ?? item.supplier_id,
      supplierName: item.supplierName ?? item.supplier_name,
      billNo: item.billNo ?? item.bill_no,
      inwardDate: item.inwardDate ?? item.inward_date,
      notes: item.notes,
      totalCost: item.totalCost ?? item.total_cost,
      createdAt: item.createdAt ?? item.created_at,
      updatedAt: item.updatedAt ?? item.updated_at,
      items: (item.items || []).map((t: any) => ({
        itemId: t.itemId ?? t.item_id,
        inwardPoId: t.inwardPoId ?? t.inward_po_id,
        purchaseOrderItemId: t.purchaseOrderItemId ?? t.purchase_order_item_id,
        masterProductId: t.masterProductId ?? t.master_product_id,
        productId: t.productId ?? t.product_id,
        unitId: t.unitId ?? t.unit_id,
        itemDescription: t.itemDescription ?? t.item_description,
        receivedQuantity: t.receivedQuantity ?? t.received_quantity,
        unit: t.unit,
        unitPrice: t.unitPrice ?? t.unit_price,
        totalCost: t.totalCost ?? t.total_cost,
        createdAt: t.createdAt ?? t.created_at,
        updatedAt: t.updatedAt ?? t.updated_at,
      })),
    } as InwardFromPoWithItems;
  },

  create: async (data: CreateInwardFromPoInput) => {
    const response = await apiClient.post<{ success: boolean; data: any }>('/inward-from-po', data);
    const item = response.data?.data;
    if (!item) throw new Error('Failed to create inward record');
    return {
      inwardPoId: item.inwardPoId ?? item.inward_po_id,
      purchaseOrderId: item.purchaseOrderId ?? item.purchase_order_id,
      poNumber: item.poNumber ?? item.po_number,
      supplierId: item.supplierId ?? item.supplier_id,
      supplierName: item.supplierName ?? item.supplier_name,
      billNo: item.billNo ?? item.bill_no,
      inwardDate: item.inwardDate ?? item.inward_date,
      notes: item.notes,
      totalCost: item.totalCost ?? item.total_cost,
      createdAt: item.createdAt ?? item.created_at,
      updatedAt: item.updatedAt ?? item.updated_at,
    } as InwardFromPoWithItems;
  },

  delete: async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/inward-from-po/${id}`
    );
    return response.data;
  },
};
