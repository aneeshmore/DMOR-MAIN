// Product Feature Types

export interface Product {
  ProductID: number;
  MasterProductID?: number;
  MasterProductName?: string;
  ProductName: string;
  ProductType: 'FG' | 'RM' | 'PM';
  UnitID?: number;
  UnitName?: string;
  PackQty?: number;
  PackagingCapacity?: number; // Capacity from packaging master (in liters)
  SellingPrice?: number;
  RawMaterialCost?: number;
  MinStockLevel?: number;
  AvailableQuantity?: number;
  ReservedQuantity?: number;
  Density?: number;
  PackagingId?: number;
  FillingDensity?: number; // Editable density for filling calculations
  IsFdSyncWithDensity?: boolean; // If true, filling density syncs with master density
  IncentiveAmount?: number;
  gst?: number;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ProductBOM {
  BOMID: number;
  FinishedGoodID: number;
  RawMaterialID: number;
  PercentageRequired: number;
  Sequence?: number;
  ProductionHours?: number;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface MasterProduct {
  masterProductId: number;
  masterProductName: string;
  productType: 'FG' | 'RM' | 'PM';
  description?: string;
  defaultUnitId?: number;
  isActive: boolean;
  gst?: number;
  createdAt?: string;
  updatedAt?: string;

  // FG-specific fields
  FGDensity?: number;
  DefaultPackagingType?: string;
  ProductionCost?: number;
  PurchaseCost?: number;
  AvailableQuantity?: number;
  Subcategory?: 'General' | 'Hardener' | 'Base' | 'Resin' | 'Extender';
  HardenerID?: number;

  // RM-specific fields
  RMDensity?: number;
  RMSolids?: number;
  StockQuantity?: number;
  CanBeAddedMultipleTimes?: boolean;
  SolidDensity?: number;
  OilAbsorption?: number;

  // PM-specific fields
  Capacity?: number;
}
