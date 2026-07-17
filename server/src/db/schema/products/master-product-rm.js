/**
 * Raw Material Master Subtype Schema
 *
 * Extended attributes for Raw Material master products.
 * Stores density, purity, and quality parameters specific to raw materials.
 */

import { integer, numeric, boolean, varchar } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { masterProducts } from './master-products.js';

export const masterProductRM = appSchema.table('master_product_rm', {
  masterProductId: integer('master_product_id')
    .primaryKey()
    .references(() => masterProducts.masterProductId, { onDelete: 'cascade' }),

  rmDensity: numeric('rm_density', { precision: 12, scale: 3 }),
  rmSolids: numeric('rm_solids', { precision: 6, scale: 2 }),
  purchaseCost: numeric('purchase_cost', { precision: 12, scale: 3 }),
  availableQty: numeric('available_qty', { precision: 18, scale: 4 }),
  canBeAddedMultipleTimes: boolean('can_be_added_multiple_times').default(false),

  // New fields for categorization
  subcategory: varchar('subcategory', { length: 50 }).default('General'), // 'General', 'Resin', 'Extender'
  solidDensity: numeric('solid_density', { precision: 12, scale: 3 }),
  oilAbsorption: numeric('oil_absorption', { precision: 12, scale: 3 }),
  hsnCode: varchar('hsn_code', { length: 50 }),
});
