import { serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';
import { company } from '../organization/company.js';
import { employees } from '../organization/employees.js';
import { productionBatch } from '../production/production-batch.js';

export const testCertificates = appSchema.table('test_certificates', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId, { onDelete: 'cascade' }),
  tenantId: varchar('tenant_id', { length: 50 }).notNull(),
  certificateNo: varchar('certificate_no', { length: 100 }).notNull().unique(),
  batchId: integer('batch_id')
    .notNull()
    .references(() => productionBatch.batchId, { onDelete: 'restrict' }),
  batchNumber: varchar('batch_number', { length: 50 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  colour: varchar('colour', { length: 100 }),
  manufacturingDate: timestamp('manufacturing_date', { withTimezone: true }),
  testingDate: timestamp('testing_date', { withTimezone: true }),
  remarks: text('remarks'),
  status: varchar('status', { length: 20 }).notNull().default('Draft'), // 'Draft' | 'Approved'
  createdBy: integer('created_by').references(() => employees.employeeId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const testCertificateResults = appSchema.table('test_certificate_results', {
  id: serial('id').primaryKey(),
  certificateId: integer('certificate_id')
    .notNull()
    .references(() => testCertificates.id, { onDelete: 'cascade' }),
  propertyName: varchar('property_name', { length: 150 }).notNull(),
  resultValue: varchar('result_value', { length: 255 }).notNull(),
  specification: varchar('specification', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
});
