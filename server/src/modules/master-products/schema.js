import { z } from 'zod';

// HSN Code validation: standard Indian GST HSN codes are 4, 6, or 8 digits.
const HSN_CODE_REGEX = /^(\d{4}|\d{6}|\d{8})$/;
const HSN_CODE_MESSAGE = 'HSN Code must be a 4, 6, or 8 digit number';

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

  // Optional for new products (FG, RM, and PM), but once provided it must be a valid 4/6/8 digit HSN code.
  HSNCode: z.preprocess(
    val => (typeof val === 'string' && val.trim() === '' ? null : typeof val === 'string' ? val.trim() : val),
    z.string().regex(HSN_CODE_REGEX, HSN_CODE_MESSAGE).nullable().optional()
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

  // Optional on update for backward compatibility with legacy products (blank allowed),
  // but once a value is provided it must be a valid 4/6/8 digit HSN code.
  HSNCode: z.preprocess(
    val => (typeof val === 'string' && val.trim() === '' ? null : typeof val === 'string' ? val.trim() : val),
    z.string().regex(HSN_CODE_REGEX, HSN_CODE_MESSAGE).nullable().optional()
  ),
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
