/**
 * Production Batches Schema
 *
 * Complete production batch tracking with full workflow support.
 * Includes scheduling, material planning, actual production data, and quality tracking.
 */

import {
  serial,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
// products table reference removed - not used in schema definition
import { employees } from '../organization/employees.js';
import { masterProductFG } from '../products/master-product-fg.js';

export const productionBatch = appSchema.table('production_batches_enhanced', {
  batchId: serial('batch_id').primaryKey(),
  batchUuid: uuid('batch_uuid').defaultRandom().notNull(),
  batchNo: varchar('batch_no', { length: 50 }).notNull().unique(),

  // Product Information
  masterProductId: integer('master_product_id')
    .notNull()
    .references(() => masterProductFG.masterProductId),

  // Planning Data
  scheduledDate: date('scheduled_date').notNull(),
  plannedQuantity: numeric('planned_quantity', { precision: 18, scale: 4 }).notNull(),
  density: numeric('density', { precision: 12, scale: 3 }),
  viscosity: numeric('viscosity', { precision: 12, scale: 3 }),
  waterPercentage: numeric('water_percentage', { precision: 5, scale: 2 }),

  // Actual Production Data
  actualQuantity: numeric('actual_quantity', { precision: 18, scale: 4 }),
  actualDensity: numeric('actual_density', { precision: 12, scale: 3 }),
  actualWeightKg: numeric('actual_weight_kg', { precision: 18, scale: 4 }), // Total weight produced in kg (actualQuantity * actualDensity)
  actualWaterPercentage: numeric('actual_water_percentage', { precision: 5, scale: 2 }),
  actualViscosity: numeric('actual_viscosity', { precision: 12, scale: 3 }),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  timeRequiredHours: numeric('time_required_hours', { precision: 8, scale: 2 }),
  actualTimeHours: numeric('actual_time_hours', { precision: 8, scale: 2 }),

  // Remarks
  pmRemarks: text('pm_remarks'),
  productionRemarks: text('production_remarks'),

  // Personnel
  supervisorId: integer('supervisor_id').references(() => employees.employeeId),
  labourNames: text('labour_names'),
  machineNo: varchar('machine_no', { length: 20 }),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('Scheduled'),
  // Values: Scheduled, In Progress, Completed, Cancelled, On Hold

  // Batch Type
  batchType: varchar('batch_type', { length: 20 }).notNull().default('MAKE_TO_ORDER'),
  // Values: MAKE_TO_ORDER, MAKE_TO_STOCK, MIXED

  // Notes & Quality
  // productionRemarks: text('production_remarks'),
  // qualityRemarks: text('quality_remarks'),
  // qualityStatus: varchar('quality_status', { length: 20 }), // Passed, Failed, Pending
  // qualityCheckedBy: integer('quality_checked_by').references(() => employees.employeeId),
  // qualityCheckedAt: timestamp('quality_checked_at', { withTimezone: true }),

  // BOM Reference
  bomVersion: integer('bom_version'), // Track which BOM version was used

  // Immutable report snapshot captured at completion. When present, the Batch
  // Production Report and Batch Report For Accounts read from this instead of
  // live master data, so historical reports never change. NULL for older
  // batches → reports fall back to live computation.
  reportSnapshot: jsonb('report_snapshot'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: integer('created_by').references(() => employees.employeeId),
  completedBy: integer('completed_by').references(() => employees.employeeId),
  cancelledBy: integer('cancelled_by').references(() => employees.employeeId),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
});
