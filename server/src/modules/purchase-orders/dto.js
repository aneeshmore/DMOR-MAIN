// DTOs for Purchase Orders module

export class PurchaseOrderDTO {
  constructor(po) {
    this.purchaseOrderId = po.purchaseOrderId || po.purchase_order_id;
    this.poNumber = po.poNumber || po.po_number;
    this.supplierId = po.supplierId || po.supplier_id;
    this.supplierName = po.supplierName || po.supplier_name || null;
    this.orderDate = po.orderDate || po.order_date;
    this.expectedDeliveryDate = po.expectedDeliveryDate || po.expected_delivery_date || null;
    this.status = po.status;
    this.totalAmount = po.totalAmount || po.total_amount || 0;
    this.notes = po.notes || null;
    this.deliveryAddress = po.deliveryAddress || po.delivery_address || null;
    this.isActive = po.isActive ?? po.is_active ?? true;
    this.createdAt = po.createdAt || po.created_at;
    this.updatedAt = po.updatedAt || po.updated_at;
  }
}

export class PurchaseOrderItemDTO {
  constructor(item) {
    this.itemId = item.itemId || item.item_id;
    this.purchaseOrderId = item.purchaseOrderId || item.purchase_order_id;
    this.itemDescription = item.itemDescription || item.item_description;
    this.quantity = item.quantity;
    this.unit = item.unit || null;
    this.unitPrice = item.unitPrice || item.unit_price || 0;
    this.totalPrice = item.totalPrice || item.total_price || 0;
    this.createdAt = item.createdAt || item.created_at;
    this.updatedAt = item.updatedAt || item.updated_at;
  }
}

export class PurchaseOrderWithItemsDTO extends PurchaseOrderDTO {
  constructor(po, items = []) {
    super(po);
    this.items = items.map(i => new PurchaseOrderItemDTO(i));
  }
}
