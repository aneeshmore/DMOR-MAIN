import { z } from 'zod';

const supplierBaseFields = {
  supplierName: z.string().min(1, 'Supplier name is required').max(255),
  contactPerson: z.string().max(255).optional(),
  mobileNo: z.string().max(20).optional(),
  mobileNo2: z.string().max(20).optional(),
  address: z.string().optional(),
  pincode: z.string().max(10).optional(),
  state: z.string().max(100).optional(),
  gstNo: z.string().max(20).optional(),
  creditDays: z.number().int().min(0).optional(),
};

export const createSupplierSchema = z.object({
  ...supplierBaseFields,
});

export const updateSupplierSchema = z.object({
  supplierName: z.string().min(1).max(255).optional(),
  contactPerson: z.string().max(255).optional(),
  mobileNo: z.string().max(20).optional(),
  mobileNo2: z.string().max(20).optional(),
  address: z.string().optional(),
  pincode: z.string().max(10).optional(),
  state: z.string().max(100).optional(),
  gstNo: z.string().max(20).optional(),
  creditDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
