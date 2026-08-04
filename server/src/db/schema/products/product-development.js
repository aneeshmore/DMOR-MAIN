/**
 * Product Development Schema
 *
 * Tracks product formula development and cost analysis.
 * Used by R&D/Production team to create and test new product formulas
 * before they become part of the standard BOM.
 */

import {
  serial,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { products } from './products.js';
import { masterProducts } from './master-products.js';
import { employees } from '../organization/employees.js';

export const productDevelopment = appSchema.table('product_development', {
  developmentId: serial('development_id').primaryKey(),
  developmentUuid: uuid('development_uuid').defaultRandom().notNull(),

  // Product Info
  categoryId: integer('category_id'), // Optional category reference
  productName: varchar('product_name', { length: 200 }).notNull(),
  masterProductId: integer('master_product_id').references(() => masterProducts.masterProductId),

  // Formula Details
  density: numeric('density', { precision: 12, scale: 3 }),
  viscosity: numeric('viscosity', { precision: 12, scale: 3 }),
  percentageValue: numeric('percentage_value', { precision: 8, scale: 4 }),
  productionHours: numeric('production_hours', { precision: 8, scale: 2 }),
  mixingRatioPart: numeric('mixing_ratio_part', { precision: 10, scale: 4 }), // Stores '2' or '1' ratio part
  calculationBasis: varchar('calculation_basis', { length: 10 }).default('Ltr'), // 'Ltr' or 'Kg'
  isSyncWithDensity: boolean('is_sync_with_density').default(true),

  // Status
  status: varchar('status', { length: 20 }).default('Draft'),
  // Values: Draft, Completed
  // Notes
  notes: text('notes'),

  // Audit
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const productDevelopmentMaterials = appSchema.table('product_development_materials', {
  devMaterialId: serial('dev_material_id').primaryKey(),

  developmentId: integer('development_id')
    .notNull()
    .references(() => productDevelopment.developmentId, { onDelete: 'cascade' }),

  materialId: integer('material_id')
    .notNull()
    .references(() => masterProducts.masterProductId),

  // Composition
  percentage: numeric('percentage', { precision: 8, scale: 4 }).notNull(),
  totalPercentage: numeric('total_percentage', { precision: 8, scale: 3 }), // User entered total %
  sequence: integer('sequence').notNull(),
  waitingTime: integer('waiting_time').default(0), // Time in minutes

  // Costing
  rate: numeric('rate', { precision: 14, scale: 3 }),
  amount: numeric('amount', { precision: 14, scale: 3 }),

  // Technical Details
  solidPercentage: numeric('solid_percentage', { precision: 5, scale: 2 }),
  solid: numeric('solid', { precision: 18, scale: 4 }),
  density: numeric('density', { precision: 12, scale: 3 }),
  wtPerLtr: numeric('wt_per_ltr', { precision: 18, scale: 4 }),
  sv: numeric('sv', { precision: 18, scale: 4 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const productDevelopmentFinishedGoods = appSchema.table(
  'product_development_finished_goods',
  {
    devFinishedGoodId: serial('dev_finished_good_id').primaryKey(),

    developmentId: integer('development_id')
      .notNull()
      .references(() => productDevelopment.developmentId, { onDelete: 'cascade' }),

    productId: integer('product_id').references(() => products.productId),
    productName: varchar('product_name', { length: 200 }).notNull(),

    // Packaging & Capacity
    packagingCost: numeric('packaging_cost', { precision: 14, scale: 3 }),
    packingCostPerUnit: numeric('packing_cost_per_unit', { precision: 14, scale: 3 }),
    packQty: numeric('pack_qty', { precision: 18, scale: 4 }), // Package count/units
    packageCapacityKg: numeric('package_capacity_kg', { precision: 12, scale: 4 }), // Weight per package in kg

    // Pricing
    unitSellingRate: numeric('unit_selling_rate', { precision: 14, scale: 3 }),
    perLtrCost: numeric('per_ltr_cost', { precision: 14, scale: 3 }),
    productionCost: numeric('production_cost', { precision: 14, scale: 3 }),
    grossProfit: numeric('gross_profit', { precision: 14, scale: 3 }),
    grossProfitPercentage: numeric('gross_profit_percentage', { precision: 5, scale: 2 }),

    // Weight Tracking
    densityKgPerL: numeric('density_kg_per_l', { precision: 12, scale: 3 }), // Density in kg/liter
    expectedTotalWeightKg: numeric('expected_total_weight_kg', { precision: 18, scale: 4 }), // Planned total weight output

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  }
);
