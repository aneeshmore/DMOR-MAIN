import { z } from 'zod';

const poItemSchema = z.object({
  itemDescription: z.string().min(1, 'Item description is required').max(500),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(50).optional(),
  unitPrice: z.number().nonnegative().optional().default(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional().nullable(),
  status: z
    .enum(['Pending', 'Confirmed', 'Received', 'Cancelled', 'Partially Received'])
    .optional()
    .default('Pending'),
  notes: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  dispatchedThrough: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1, 'At least one item is required'),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive().optional(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  status: z
    .enum(['Pending', 'Confirmed', 'Received', 'Cancelled', 'Partially Received'])
    .optional(),
  notes: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  dispatchedThrough: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1).optional(),
});
