/**
 * Production Manager Schema Validations
 *
 * Validates input for production manager workflows including:
 * - Inventory checks
 * - Batch scheduling
 * - Order assessment
 */

import { z } from 'zod';

export const checkInventorySchema = z.object({
  products: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
      })
    )
    .min(1, 'At least one product is required'),
});

export const updateDeliveryDateSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1, 'At least one order is required'),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
});

export const scheduleBatchSchema = z.object({
  masterProductId: z.number().int().positive(),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  plannedQuantity: z.number().positive(),
  density: z.number().optional(),
  viscosity: z.number().optional(),
  waterPercentage: z.number().min(0).max(1000).optional(),
  supervisorId: z.number().int().positive(),
  orders: z
    .array(
      z.object({
        orderId: z.number().int().min(0), // Allow 0 for internal/aggregates
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
      })
    )
    .default([]), // Allow empty list for Make to Stock
  materials: z
    .array(
      z.object({
        materialId: z.number().int().positive(),
        requiredQuantity: z.number().min(0),
        requiredUsePer: z.number().optional(),
        requiredUseQty: z.number().optional(),
        sequence: z.number().optional(),
        waitingTime: z.number().optional(),
        isAdditional: z.boolean().optional(),
      })
    )
    .optional(),
  expectedDeliveryDate: z.string().optional(),
  pmRemarks: z.string().optional(),
  labourNames: z.string().optional(),
  machineNo: z.string().max(20).optional(),
});

export const updateBatchSchema = z.object({
  scheduledDate: z.string().optional(),
  plannedQuantity: z.number().positive().optional(),
  density: z.number().positive().optional(),
  waterPercentage: z.number().min(0).max(100).optional(),
  viscosity: z.string().optional(),
  supervisorId: z.number().int().positive().optional(),
  labourNames: z.string().optional(),
  machineNo: z.string().max(20).optional(),
  remarks: z.string().optional(),
});

export const cancelBatchSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const autoScheduleSchema = z.object({
  orderId: z.number().int().positive(),
  expectedDeliveryDate: z.string().min(1, 'Expected delivery date is required'),
});
