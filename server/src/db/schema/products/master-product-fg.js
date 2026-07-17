/**
 * Finished Goods Master Subtype Schema
 *
 * Extended attributes for Finished Goods master products.
 * Stores default values for density, solid percentage, and packaging.
 */

import { integer, numeric, varchar } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { masterProducts } from './master-products.js';

export const masterProductFG = appSchema.table('master_product_fg', {
  masterProductId: integer('master_product_id')
    .primaryKey()
    .references(() => masterProducts.masterProductId, { onDelete: 'cascade' }),

  defaultPackagingType: varchar('default_packaging_type', { length: 100 }),
  fgDensity: numeric('fg_density', { precision: 12, scale: 3 }),
  viscosity: numeric('viscosity', { precision: 12, scale: 3 }),
  waterPercentage: numeric('water_percentage', { precision: 5, scale: 2 }),
  productionCost: numeric('production_cost', { precision: 12, scale: 3 }),
  availableQuantity: numeric('available_quantity', { precision: 18, scale: 4 }).default(0),
  purchaseCost: numeric('purchase_cost', { precision: 12, scale: 3 }),

  // New fields for categorization
  subcategory: varchar('subcategory', { length: 50 }).default('General'), // 'General', 'Hardener', 'Base'
  hardenerId: integer('hardener_id').references(() => masterProducts.masterProductId),
  hsnCode: varchar('hsn_code', { length: 50 }),
});
