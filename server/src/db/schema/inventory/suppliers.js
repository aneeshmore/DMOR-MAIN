/**
 * Suppliers Schema
 *
 * Manages supplier information for material inward tracking.
 * Each supplier can have multiple bills with the same bill number.
 */

import { serial, varchar, boolean, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';

export const suppliers = appSchema.table('suppliers', {
  supplierId: serial('supplier_id').primaryKey(),
  supplierName: varchar('supplier_name', { length: 255 }).notNull().unique(),
  contactPerson: varchar('contact_person', { length: 255 }),
  mobileNo: varchar('mobile_no', { length: 20 }),
  mobileNo2: varchar('mobile_no2', { length: 20 }),
  address: text('address'),
  pincode: varchar('pincode', { length: 10 }),
  state: varchar('state', { length: 100 }),
  gstNo: varchar('gst_no', { length: 20 }),
  creditDays: integer('credit_days'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
