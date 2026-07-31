export interface InwardEntry {
  inwardId: number;
  inwardUuid: string;
  productId: number;
  productName?: string;
  skuProductName?: string; // For FG: SKU name like "Black JAPAN 1L"
  productType?: 'FG' | 'RM' | 'PM';
  supplierId: number;
  supplierName?: string;
  customerId?: number; // For FG returns
  customerName?: string; // For FG returns
  inwardDate: string;
  quantity: number;
  unitId?: number;
  unitName?: string;
  unitPrice: number;
  totalCost: number;
  billNo?: string;
  notes?: string;
  skuId?: number; // For FG: specific SKU ID
  createdAt: string;
  updatedAt: string;
}

export interface InwardItemInput {
  inwardId?: number;
  masterProductId: number;
  productId?: number; // For FG: specific SKU
  inwardDate?: string;
  quantity: number;
  unitId?: number;
  unitPrice?: number;
  totalCost?: number;
  skipCostUpdate?: boolean; // If true, saves unitPrice in the inward record but does NOT update masterProductFG.purchaseCost
}

export interface CreateInwardInput {
  billNo: string;
  supplierId?: number; // For RM/PM
  customerId?: number; // For FG returns
  notes?: string;
  items: InwardItemInput[];
}

export interface UpdateInwardInput {
  masterProductId?: number;
  productId?: number; // For FG: specific SKU
  inwardDate?: string;
  billNo?: string;
  quantity?: number;
  unitId?: number;
  unitPrice?: number;
  totalCost?: number;
  notes?: string;
  supplierId?: number;
  customerId?: number; // For FG returns
}
