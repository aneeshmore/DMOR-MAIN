/**
 * Purchase Orders Schema
 *
 * Tracks purchase orders raised against vendors/suppliers.
 * Each purchase order can have multiple line items (purchase_order_items).
 */

import {
  serial,
  varchar,
  boolean,
  timestamp,
  text,
  integer,
  numeric,
  date,
} from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { suppliers } from './suppliers.js';

export const purchaseOrders = appSchema.table('purchase_orders', {
  purchaseOrderId: serial('purchase_order_id').primaryKey(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  supplierId: integer('supplier_id').references(() => suppliers.supplierId),
  orderDate: date('order_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),
  status: varchar('status', { length: 50 }).default('Pending').notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).default('0'),
  notes: text('notes'),
  deliveryAddress: text('delivery_address'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const purchaseOrderItems = appSchema.table('purchase_order_items', {
  itemId: serial('item_id').primaryKey(),
  purchaseOrderId: integer('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.purchaseOrderId),
  itemDescription: varchar('item_description', { length: 500 }).notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 50 }),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).default('0'),
  totalPrice: numeric('total_price', { precision: 14, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
