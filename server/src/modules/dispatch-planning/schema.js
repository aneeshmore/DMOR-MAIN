import { z } from 'zod';

export const createDispatchSchema = z.object({
  vehicleNo: z.string().min(1, 'Vehicle No is required'),
  vehicleModel: z.string().optional(),
  capacity: z.number().optional(),
  driverName: z.string().optional(),
  remarks: z.string().optional(),
  orderIds: z.array(z.number()).min(1, 'Select at least one order'),
});

export const createVehicleSchema = z.object({
  vehicleNumber: z.string().trim().min(1, 'Vehicle number is required').max(50),
  driverName: z.string().trim().max(100).optional().nullable(),
  capacity: z.number().nonnegative('Capacity cannot be negative').optional().nullable(),
});
