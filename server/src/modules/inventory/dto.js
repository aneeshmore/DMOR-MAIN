export class ProductDTO {
  constructor(data) {
    // Handle joined result { products: ..., master_products: ... } or flat product object
    const product = data.products || data;
    const master = data.master_products || {};
    const unit = data.units || {};

    this.productId = product.productId || product.product_id;
    this.productUuid = product.productUuid || product.product_uuid;
    this.productName = product.productName || product.product_name;
    this.masterProductId = product.masterProductId || product.master_product_id;

    // Derived fields from Master Product or relationships
    this.unitId =
      master.defaultUnitId ||
      master.default_unit_id ||
      unit.unitId ||
      unit.unit_id ||
      product.unitId ||
      product.unit_id;
    this.productType =
      master.productType || master.product_type || product.productType || product.product_type;

    this.sellingPrice = product.sellingPrice || product.selling_price;
    this.minStockLevel = product.minStockLevel || product.min_stock_level;
    this.availableQuantity = product.availableQuantity || product.available_quantity;
    this.density = product.density;
    this.isActive = product.isActive ?? product.is_active;
    this.createdAt = product.createdAt || product.created_at;
    this.updatedAt = product.updatedAt || product.updated_at;

    // FG-specific fields for auto-add Hardener feature
    this.Subcategory = data.subcategory || product.subcategory || null;
    this.HardenerId = data.hardenerId || product.hardenerId || product.hardener_id || null;
    this.CapacityLtr = data.pmCapacity || product.pmCapacity || product.capacity || null;

    // HSN Code (from master product subtype: FG / RM / PM)
    this.hsnCode = data.hsnCode || product.hsnCode || product.hsn_code || '';
  }
}

export class StockLedgerDTO {
  constructor(ledger) {
    this.ledgerId = ledger.ledgerId || ledger.ledger_id;
    this.productId = ledger.productId || ledger.product_id;
    this.changeType = ledger.changeType || ledger.change_type;
    this.changeQty = ledger.changeQty || ledger.change_qty;
    this.referenceTable = ledger.referenceTable || ledger.reference_table;
    this.referenceId = ledger.referenceId || ledger.reference_id;
    this.createdBy = ledger.createdBy || ledger.created_by;
    this.createdAt = ledger.createdAt || ledger.created_at;
    this.notes = ledger.notes;
  }
}
