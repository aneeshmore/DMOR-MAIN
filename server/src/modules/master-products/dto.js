export class MasterProductDTO {
  constructor(data) {
    // Handle both joined query result and single master product
    const masterProduct = data.masterProduct || data;
    const fgDetails = data.fgDetails;
    const rmDetails = data.rmDetails;
    const pmDetails = data.pmDetails;

    this.masterProductId = masterProduct.masterProductId || masterProduct.master_product_id;
    this.masterProductName = masterProduct.masterProductName || masterProduct.master_product_name;
    this.productType = masterProduct.productType || masterProduct.product_type;
    this.description = masterProduct.description;
    this.defaultUnitId = masterProduct.defaultUnitId || masterProduct.default_unit_id;
    this.isActive = masterProduct.isActive ?? masterProduct.is_active ?? true;
    this.gst =
      masterProduct.gst !== undefined && masterProduct.gst !== null
        ? parseFloat(masterProduct.gst)
        : null;
    this.GST = this.gst;
    this.createdAt = masterProduct.createdAt || masterProduct.created_at;
    this.updatedAt = masterProduct.updatedAt || masterProduct.updated_at;

    // Add aliases for frontend compatibility (InwardForm expects these properties)
    this.productId = this.masterProductId;
    this.productName = this.masterProductName;
    this.unitId = this.defaultUnitId;

    // Add type-specific fields based on product type
    if (fgDetails) {
      this.defaultPackagingType =
        fgDetails.defaultPackagingType || fgDetails.default_packaging_type;
      this.FGDensity = parseFloat(fgDetails.fgDensity || fgDetails.fg_density || 0);
      this.ProductionCost = parseFloat(fgDetails.productionCost || fgDetails.production_cost || 0);
      this.PurchaseCost = parseFloat(fgDetails.purchaseCost || fgDetails.purchase_cost || 0);
      this.AvailableQuantity = parseInt(
        fgDetails.availableQuantity || fgDetails.available_quantity || 0
      );
      this.Subcategory = fgDetails.subcategory || 'General';
      this.HardenerID = fgDetails.hardenerId || fgDetails.hardener_id || null;
    }

    if (rmDetails) {
      this.RMDensity = parseFloat(rmDetails.rmDensity || rmDetails.rm_density || 0);
      this.RMSolids = parseFloat(rmDetails.rmSolids || rmDetails.rm_solids || 0);
      this.StockQuantity = parseFloat(rmDetails.stockQuantity || rmDetails.stock_quantity || 0);
      this.PurchaseCost = parseFloat(rmDetails.purchaseCost || rmDetails.purchase_cost || 0);
      this.AvailableQuantity = parseFloat(rmDetails.availableQty || rmDetails.available_qty || 0);
      this.CanBeAddedMultipleTimes =
        rmDetails.canBeAddedMultipleTimes || rmDetails.can_be_added_multiple_times || false;
      this.Subcategory = rmDetails.subcategory || 'General';
      this.SolidDensity = parseFloat(rmDetails.solidDensity || rmDetails.solid_density || 0);
      this.OilAbsorption = parseFloat(rmDetails.oilAbsorption || rmDetails.oil_absorption || 0);
    }

    if (pmDetails) {
      this.Capacity = parseFloat(pmDetails.capacity || 0);
      this.StockQuantity = parseInt(pmDetails.stockQuantity || pmDetails.stock_quantity || 0);
      this.PurchaseCost = parseFloat(pmDetails.purchaseCost || pmDetails.purchase_cost || 0);
      this.AvailableQuantity = parseFloat(pmDetails.availableQty || pmDetails.available_qty || 0);
    }

    this.purchaseCost = this.PurchaseCost || 0;
  }
}

export class ProductDTO {
  constructor(data) {
    // Handle both joined query result and single product
    const product = data.product || data;
    const masterProduct = data.masterProduct;
    const unit = data.unit;

    const packagingDetails = data.packagingDetails;

    this.ProductID = product.productId || product.product_id;
    this.ProductUUID = product.productUuid || product.product_uuid;
    this.ProductName = product.productName || product.product_name;
    this.MasterProductID = product.masterProductId || product.master_product_id;
    this.UnitID = product.unitId || product.unit_id;
    this.ProductType =
      product.productType ||
      product.product_type ||
      (masterProduct && (masterProduct.productType || masterProduct.product_type));
    const fgDetails = data.fgDetails;

    // Dynamic Calculation of Capacity
    // 1. Packaging Capacity (Ltr) from PM
    const pmCapacity = parseFloat((packagingDetails && packagingDetails.capacity) || 0);

    // 2. FG Density from Master Product
    const fgDensity = parseFloat(
      (fgDetails && fgDetails.fgDensity) || (fgDetails && fgDetails.fg_density) || 0
    );

    this.CapacityLtr = pmCapacity;

    this.SellingPrice = parseFloat(product.sellingPrice || product.selling_price || 0);
    this.MinStockLevel = parseFloat(product.minStockLevel || product.min_stock_level || 0);
    this.AvailableQuantity = parseFloat(
      product.availableQuantity || product.available_quantity || 0
    );

    // 3. Package Capacity (Kg) = Capacity (Ltr) * Density
    this.PackageCapacityKg = pmCapacity * fgDensity;
    this.packageCapacityKg = this.PackageCapacityKg;

    // Filling Density fields
    this.FillingDensity = parseFloat(product.fillingDensity || product.filling_density || 0);
    this.IsFdSyncWithDensity =
      product.isFdSyncWithDensity ?? product.is_fd_sync_with_density ?? false;

    // camelCase support for frontend
    this.productId = this.ProductID;
    this.productName = this.ProductName;
    this.masterProductId = this.MasterProductID;
    this.unitId = this.UnitID;
    this.productType = this.ProductType;
    this.packagingCapacity = this.CapacityLtr; // New name
    this.packageQuantity = this.CapacityLtr; // Keep for backward compat
    this.packagingCapacityLtr = this.CapacityLtr; // Map for frontend use
    this.PackagingCapacity = this.CapacityLtr; // Explicitly for Costing Table
    this.sellingPrice = this.SellingPrice;
    this.minStockLevel = this.MinStockLevel;
    this.availableQuantity = this.AvailableQuantity;
    this.fillingDensity = this.FillingDensity;
    this.isFdSyncWithDensity = this.IsFdSyncWithDensity;

    // Override with Master Product stock for RM and PM if available (since Inward updates Master Product)
    const rmDetails = data.rmDetails;
    const pmDetails = data.pmDetails;

    if (this.ProductType === 'RM' && rmDetails) {
      this.availableQuantity = parseFloat(
        rmDetails.availableQty || rmDetails.available_qty || this.availableQuantity
      );
      this.AvailableQuantity = this.availableQuantity;
    } else if (this.ProductType === 'PM' && pmDetails) {
      this.availableQuantity = parseFloat(
        pmDetails.availableQty || pmDetails.available_qty || this.availableQuantity
      );
      this.AvailableQuantity = this.availableQuantity;
    }
    this.ReservedQuantity = parseFloat(product.reservedQuantity || product.reserved_quantity || 0);
    this.reservedQuantity = this.ReservedQuantity;

    this.Density = parseFloat(product.density || 0);
    this.density = this.Density;

    this.PackagingId = product.packagingId || product.packaging_id;
    this.packagingId = this.PackagingId;

    this.TotalDensity = fgDensity; // Explicitly map for frontend calculation
    this.totalDensity = fgDensity;

    this.IncentiveAmount = parseFloat(product.incentiveAmount || product.incentive_amount || 0);
    this.incentiveAmount = this.IncentiveAmount;

    this.RawMaterialCost = parseFloat(product.rawMaterialCost || product.raw_material_cost || 0);
    this.rawMaterialCost = this.RawMaterialCost;

    this.IsActive = product.isActive ?? product.is_active ?? true;
    this.isActive = this.IsActive;

    this.CreatedAt = product.createdAt || product.created_at;
    this.createdAt = this.CreatedAt;

    this.UpdatedAt = product.updatedAt || product.updated_at;
    this.updatedAt = this.UpdatedAt;

    // Include related data if available
    if (masterProduct) {
      this.MasterProductName = masterProduct.masterProductName || masterProduct.master_product_name;
      this.masterProductName = this.MasterProductName;
      this.gst =
        masterProduct.gst !== undefined && masterProduct.gst !== null
          ? parseFloat(masterProduct.gst)
          : null;
      this.GST = this.gst;
    }

    if (unit) {
      this.UnitName = unit.unitName || unit.unit_name;
      this.unitName = this.UnitName;
    }
  }
}
