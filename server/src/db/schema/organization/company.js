import { pgTable, serial, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from '../core/app-schema.js';

export const company = appSchema.table('company', {
  companyId: serial('company_id').primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  logoUrl: text('logo_url'),
  address: text('address'),
  factoryAddress: text('factory_address'),
  gstNumber: varchar('gst_number', { length: 50 }),
  email: varchar('email', { length: 255 }),
  contactNumber: varchar('contact_number', { length: 50 }),
  panNumber: varchar('pan_number', { length: 50 }),
  // Bank Details
  bankName: varchar('bank_name', { length: 100 }),
  accountNumber: varchar('account_number', { length: 50 }),
  ifscCode: varchar('ifsc_code', { length: 20 }),
  branch: varchar('branch', { length: 100 }),
  termsAndConditions: text('terms_and_conditions'),

  // New Fields
  udyamRegistrationNumber: varchar('udyam_registration_number', { length: 50 }),
  pincode: varchar('pincode', { length: 20 }),
  state: varchar('state', { length: 100 }),
  cgst: varchar('cgst', { length: 50 }),
  sgst: varchar('sgst', { length: 50 }),
  igst: varchar('igst', { length: 50 }),

  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});
