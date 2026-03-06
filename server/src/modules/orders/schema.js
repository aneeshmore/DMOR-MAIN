import { z } from 'zod';

// Order validation schemas
export const createOrderSchema = z.object({
  customerId: z.number().int().positive(),
  salespersonId: z.number().int().positive(),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional().default('Normal'),
  status: z
    .enum([
      'Pending',
      'On Hold',
      'Accepted',
      'Scheduled for Production',
      'Ready for Dispatch',
      'Confirmed',
      'Started',
      'Dispatched',
      'Delivered',
      'Cancelled',
    ])
    .optional()
    .default('Pending'),
  orderDate: z.string().datetime().optional(),
  deliveryAddress: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  orderDetails: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().min(0).max(100).optional().default(0),
      })
    )
    .min(1),
});

export const updateOrderSchema = z.object({
  customerId: z.number().int().positive().optional(),
  salespersonId: z.number().int().positive().optional(),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
  status: z
    .enum([
      'Pending',
      'On Hold',
      'Accepted',
      'Scheduled for Production',
      'Ready for Dispatch',
      'Confirmed',
      'Started',
      'Dispatched',
      'Delivered',
      'Cancelled',
    ])
    .optional(),
  deliveryAddress: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  expectedDeliveryDate: z.string().datetime().or(z.date()).nullable().optional(), // Production manager field
  orderDetails: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().nonnegative(),
        discount: z.coerce.number().min(0).max(100).optional().default(0),
      })
    )
    .min(1)
    .optional(),
});

export const updateOrderDetailSchema = z.object({
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
});
