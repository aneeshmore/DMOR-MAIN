import { z } from 'zod';

// Master Product schemas
export const createMasterProductSchema = z.object({
  MasterProductName: z.string().min(1, 'Master product name is required').max(255),
  ProductType: z.enum(['FG', 'RM', 'PM'], {
    errorMap: () => ({
      message:
        'Product type must be FG (Finished Goods), RM (Raw Material), or PM (Packaging Material)',
    }),
  }),
  Description: z.string().optional().nullable(),
  DefaultUnitID: z.number().int().positive().optional().nullable(),

  // FG-specific fields
  DefaultPackagingType: z.string().max(100).optional().nullable(),
  Subcategory: z
    .enum(['General', 'Hardener', 'Base', 'Resin', 'Extender'])
    .optional()
    .default('General'),
  HardenerID: z.number().int().positive().optional().nullable(),

  // RM-specific fields
  RMDensity: z.number().min(0).optional().nullable(),
  RMSolids: z.number().min(0).max(100).optional().nullable(),
  StockQuantity: z.number().min(0).optional().nullable(), // Added
  CanBeAddedMultipleTimes: z.boolean().optional().default(false),
  SolidDensity: z.number().min(0).optional().nullable(),
  OilAbsorption: z.number().min(0).optional().nullable(),

  // PM-specific fields
  Capacity: z.number().min(0).optional().nullable(),
  // StockQuantity is shared with RM above

  GST: z.preprocess(
    val => (val === '' || val === undefined ? null : Number(val)),
    z.number().min(0).max(100).nullable().optional()
  ),
});

export const updateMasterProductSchema = z.object({
  MasterProductName: z.string().min(1).max(255).optional(),
  Description: z.string().optional().nullable(),
  DefaultUnitID: z.number().int().positive().optional().nullable(),
  IsActive: z.boolean().optional(),
  GST: z.preprocess(
    val => (val === '' || val === undefined ? null : Number(val)),
    z.number().min(0).max(100).nullable().optional()
  ),

  // FG-specific fields
  DefaultPackagingType: z.string().max(100).optional().nullable(),
  Subcategory: z.enum(['General', 'Hardener', 'Base', 'Resin', 'Extender']).optional(),
  HardenerID: z.number().int().positive().optional().nullable(),

  // RM-specific fields
  RMDensity: z.number().min(0).optional().nullable(),
  RMSolids: z.number().min(0).max(100).optional().nullable(),
  StockQuantity: z.number().min(0).optional().nullable(),
  CanBeAddedMultipleTimes: z.boolean().optional(),
  SolidDensity: z.number().min(0).optional().nullable(),
  OilAbsorption: z.number().min(0).optional().nullable(),

  // PM-specific fields
  Capacity: z.number().min(0).optional().nullable(),
  // StockQuantity is already defined above in object, Zod treats it singly. To support it specifically for PM update alongside RM, we rely on service layer to pick it based on type.
  // Ideally Zod object keys are unique. Since RM and PM share 'StockQuantity' name in DTO/Input, one definition covers both if they have same validation.
});

// Product schemas
export const createProductSchema = z.object({
  ProductName: z.string().min(1, 'Product name is required').max(255),
  MasterProductID: z.number().int().positive().optional().nullable(),
  UnitID: z.number().int().positive('Unit is required'),
  ProductType: z.enum(['FG', 'RM', 'PM'], {
    errorMap: () => ({
      message:
        'Product type must be FG (Finished Goods), RM (Raw Material), or PM (Packaging Material)',
    }),
  }),
  SellingPrice: z.number().min(0).optional().default(0),
  MinStockLevel: z.number().min(0).optional().default(0),
  PackagingId: z.number().int().positive().optional().nullable(),
  IncentiveAmount: z.number().min(0).optional().default(0),
  FillingDensity: z.number().min(0).optional().nullable(),
  IsFdSyncWithDensity: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  ProductName: z.string().min(1).max(255).optional(),
  MasterProductID: z.number().int().positive().optional().nullable(),
  UnitID: z.number().int().positive().optional(),
  ProductType: z.enum(['FG', 'RM', 'PM']).optional(),
  SellingPrice: z.number().min(0).optional(),
  MinStockLevel: z.number().min(0).optional(),
  PackagingId: z.number().int().positive().optional().nullable(),
  IncentiveAmount: z.number().min(0).optional(),
  FillingDensity: z.number().min(0).optional().nullable(),
  IsFdSyncWithDensity: z.boolean().optional(),
  IsActive: z.boolean().optional(),
});
