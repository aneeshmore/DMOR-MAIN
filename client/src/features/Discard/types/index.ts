export interface DiscardEntry {
  discardId: number;
  productId: number;
  productName?: string;
  productType?: 'FG' | 'RM' | 'PM';
  /** Live/current stock of the product right now — used in the per-product summary only. */
  currentStock?: number;
  /**
   * Stock remaining immediately after THIS specific discard event (point-in-time), read
   * from the inventory transaction logged for it. Undefined for events whose audit row
   * is missing, in which case the UI shows '-' rather than a misleading figure.
   */
  stockAfterDiscard?: number;
  discardDate: string;
  quantity: number;
  reason?: string;
  notes?: string;
  createdAt?: string;
}

export interface CreateDiscardInput {
  productId: number;
  productType: 'FG' | 'RM' | 'PM';
  unitId?: number;
  discardDate?: string;
  quantityPerUnit: number;
  numberOfUnits: number;
  reason?: string;
  notes?: string;
}

export interface UpdateDiscardInput {
  productId?: number;
  discardDate?: string;
  quantity?: number;
  reason?: string;
  notes?: string;
}
