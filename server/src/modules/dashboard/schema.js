import { z } from 'zod';

export const orderStatusSchema = z.object({
  status: z
    .enum([
      // New workflow statuses
      'Pending Accounts Approval',
      'Pending Factory Approval',
      'Factory Approved',
      'Scheduled for Production',
      'Ready for Dispatch',
      'Dispatched',
      'On Hold',
      // Legacy statuses (existing orders)
      'Pending',
      'Verified',
      'Accepted',
      'Delivered',
      'Cancelled',
    ])
    .optional()
    .default('Pending Accounts Approval'),
});
