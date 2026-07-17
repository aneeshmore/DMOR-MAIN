/**
 * Packaging Material Master Subtype Schema
 *
 * Extended attributes for Packaging Material master products.
 * Stores material type, dimensions, and weight specifications.
 */

import { integer, numeric, varchar } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { masterProducts } from './master-products.js';

export const masterProductPM = appSchema.table('master_product_pm', {
  masterProductId: integer('master_product_id')
    .primaryKey()
    .references(() => masterProducts.masterProductId, { onDelete: 'cascade' }),

  capacity: numeric('capacity', { precision: 12, scale: 4 }),
  purchaseCost: numeric('purchase_cost', { precision: 12, scale: 3 }),
  availableQty: numeric('available_qty', { precision: 18, scale: 4 }),
  hsnCode: varchar('hsn_code', { length: 50 }),
});
