/**
 * Master Products Schema
 *
 * Parent table for all product types (Finished Goods, Raw Materials, Packaging Materials).
 * This follows a polymorphic pattern where each product type has its own subtype table.
 */

import { serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';

export const masterProducts = appSchema.table('master_products', {
  masterProductId: serial('master_product_id').primaryKey(),
  masterProductName: varchar('master_product_name', { length: 255 }).notNull(),
  productType: varchar('product_type', { length: 5 }).notNull(), // FG | RM | PM
  description: text('description'),
  defaultUnitId: integer('default_unit_id'),
  isActive: boolean('is_active').notNull().default(true),
  minStockLevel: integer('min_stock_level').default(0), // Global min stock for master product
  gst: varchar('gst', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
