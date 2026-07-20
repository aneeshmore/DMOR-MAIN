/**
 * Vehicles Schema
 *
 * Manages delivery and transport vehicles.
 * Tracks vehicle availability, driver information, and capacity.
 */

import { serial, varchar, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './app-schema.js';

export const vehicles = appSchema.table('vehicles', {
  vehicleId: serial('vehicle_id').primaryKey(),
  vehicleNumber: varchar('vehicle_number', { length: 50 }).notNull().unique(),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  driverName: varchar('driver_name', { length: 100 }),
  capacity: numeric('capacity', { precision: 12, scale: 4 }),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
