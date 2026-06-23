import { relations } from 'drizzle-orm';
import { testCertificates, testCertificateResults } from './test-certificate.js';
import { company } from '../organization/company.js';
import { employees } from '../organization/employees.js';
import { productionBatch } from '../production/production-batch.js';

export const testCertificatesRelations = relations(testCertificates, ({ one, many }) => ({
  company: one(company, {
    fields: [testCertificates.companyId],
    references: [company.companyId],
  }),
  creator: one(employees, {
    fields: [testCertificates.createdBy],
    references: [employees.employeeId],
  }),
  productionBatch: one(productionBatch, {
    fields: [testCertificates.batchId],
    references: [productionBatch.batchId],
  }),
  results: many(testCertificateResults),
}));

export const testCertificateResultsRelations = relations(testCertificateResults, ({ one }) => ({
  certificate: one(testCertificates, {
    fields: [testCertificateResults.certificateId],
    references: [testCertificates.id],
  }),
}));
