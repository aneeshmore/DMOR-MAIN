import { z } from 'zod';

export const createInwardFromPoSchema = z.object({
  purchaseOrderId: z.number().int().positive('Purchase Order is required'),
  supplierId: z.number().int().positive('Supplier is required'),
  billNo: z.string().min(1, 'Bill No is required').max(50),
  inwardDate: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.number().int().positive().optional(),
        itemDescription: z.string().min(1, 'Item description is required'),
        receivedQuantity: z.number().positive('Received quantity must be positive'),
        unit: z.string().max(50).optional(),
        unitPrice: z.number().nonnegative().optional().default(0),
        totalCost: z.number().nonnegative().optional().default(0),
        masterProductId: z.number().int().nullable().optional(),
        productId: z.number().int().nullable().optional(),
        unitId: z.number().int().nullable().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

export const updateInwardFromPoSchema = z.object({
  billNo: z.string().max(50).optional(),
  inwardDate: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.number().int().positive().optional(),
        itemDescription: z.string().min(1).optional(),
        receivedQuantity: z.number().positive().optional(),
        unit: z.string().max(50).optional(),
        unitPrice: z.number().nonnegative().optional(),
        totalCost: z.number().nonnegative().optional(),
        masterProductId: z.number().int().nullable().optional(),
        productId: z.number().int().nullable().optional(),
        unitId: z.number().int().nullable().optional(),
      })
    )
    .optional(),
});
