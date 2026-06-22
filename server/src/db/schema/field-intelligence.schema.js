import {
  uuid,
  varchar,
  timestamp,
  integer,
  numeric,
  jsonb,
  boolean,
  text,
} from 'drizzle-orm/pg-core';
import { appSchema } from './core/app-schema.js';
import { employees } from './organization/employees.js';
import { company } from './organization/company.js';

export const fieldIntelligenceReports = appSchema.table('field_intelligence_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportNumber: varchar('report_number', { length: 100 }).unique().notNull(),
  visitDate: timestamp('visit_date', { withTimezone: true }).defaultNow(),
  timeIn: varchar('time_in', { length: 50 }),
  timeOut: varchar('time_out', { length: 50 }),
  visitDuration: integer('visit_duration'),
  gpsLatitude: numeric('gps_latitude', { precision: 10, scale: 8 }),
  gpsLongitude: numeric('gps_longitude', { precision: 11, scale: 8 }),
  executiveId: integer('executive_id')
    .notNull()
    .references(() => employees.employeeId),
  executiveName: varchar('executive_name', { length: 255 }),
  branch: varchar('branch', { length: 255 }),
  region: varchar('region', { length: 255 }),
  visitType: varchar('visit_type', { length: 50 }).default('New Visit'),
  visitPurpose: jsonb('visit_purpose').default([]),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  designation: varchar('designation', { length: 255 }),
  mobile: varchar('mobile', { length: 50 }),
  whatsapp: varchar('whatsapp', { length: 50 }),
  email: varchar('email', { length: 255 }),
  gstNumber: varchar('gst_number', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  pinCode: varchar('pin_code', { length: 20 }),
  businessCategory: varchar('business_category', { length: 100 }),
  monthlyConsumption: numeric('monthly_consumption', { precision: 15, scale: 2 }),
  currentSupplier: varchar('current_supplier', { length: 255 }),
  paintRequirementTypes: jsonb('paint_requirement_types').default([]),
  surfaceTypes: jsonb('surface_types').default([]),
  applicationMethods: jsonb('application_methods').default([]),
  requiredShade: varchar('required_shade', { length: 255 }),
  requiredFinish: varchar('required_finish', { length: 255 }),
  technicalChallenges: jsonb('technical_challenges').default([]),
  currentSystemUsed: text('current_system_used'),
  monthlyConsumptionText: text('monthly_consumption_text'),
  currentPurchaseRate: numeric('current_purchase_rate', { precision: 15, scale: 2 }),
  expectedRate: numeric('expected_rate', { precision: 15, scale: 2 }),
  creditDays: integer('credit_days').default(0),
  outstandingAmount: numeric('outstanding_amount', { precision: 15, scale: 2 }).default(0.0),
  purchaseDecisionBy: varchar('purchase_decision_by', { length: 255 }),
  purchaseCycle: varchar('purchase_cycle', { length: 100 }),
  potentialBusinessValue: numeric('potential_business_value', { precision: 15, scale: 2 }).default(
    0.0
  ),
  expectedMonthlyBusiness: numeric('expected_monthly_business', {
    precision: 15,
    scale: 2,
  }).default(0.0),
  conversionProbability: integer('conversion_probability').default(0),
  discussionNotes: text('discussion_notes'),
  importantObservations: text('important_observations'),
  customerMood: varchar('customer_mood', { length: 50 }),
  hiddenOpportunity: text('hidden_opportunity'),
  riskFactors: text('risk_factors'),
  immediateRequirement: text('immediate_requirement'),
  expectedOrderDate: timestamp('expected_order_date', { withTimezone: true }),
  expectedOrderQuantity: numeric('expected_order_quantity', { precision: 15, scale: 2 }).default(
    0.0
  ),
  trialApproved: boolean('trial_approved').default(false),
  sampleGiven: boolean('sample_given').default(false),
  followupUrgencyScore: integer('followup_urgency_score').default(0),
  dealerConfidence: integer('dealer_confidence').default(0),
  paymentReliability: integer('payment_reliability').default(0),
  relationshipStrength: integer('relationship_strength').default(0),
  technicalCapability: integer('technical_capability').default(0),
  longTermPotential: integer('long_term_potential').default(0),
  executiveRecommendation: text('executive_recommendation'),
  status: varchar('status', { length: 50 }).default('Draft').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceFollowups = appSchema.table('field_intelligence_followups', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => fieldIntelligenceReports.id, { onDelete: 'cascade' }),
  followupDate: timestamp('followup_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('Open').notNull(),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceUploads = appSchema.table('field_intelligence_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => fieldIntelligenceReports.id, { onDelete: 'cascade' }),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  uploadedBy: integer('uploaded_by').references(() => employees.employeeId, {
    onDelete: 'set null',
  }),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceCompetitors = appSchema.table('field_intelligence_competitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => fieldIntelligenceReports.id, { onDelete: 'cascade' }),
  competitorName: varchar('competitor_name', { length: 255 }).notNull(),
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  reasonUsingCompetitor: text('reason_using_competitor'),
  reasonShiftToUs: text('reason_shift_to_us'),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceActivityLog = appSchema.table('field_intelligence_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').references(() => fieldIntelligenceReports.id, {
    onDelete: 'cascade',
  }),
  activityType: varchar('activity_type', { length: 100 }).notNull(),
  details: jsonb('details').default({}),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceAiInsights = appSchema.table('field_intelligence_ai_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => fieldIntelligenceReports.id, { onDelete: 'cascade' }),
  insightType: varchar('insight_type', { length: 100 }).notNull(),
  observation: text('observation').notNull(),
  reasoning: text('reasoning'),
  severity: varchar('severity', { length: 50 }).default('medium'),
  companyId: integer('company_id')
    .notNull()
    .references(() => company.companyId),
  tenantId: uuid('tenant_id').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => employees.employeeId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldIntelligenceDashboardMetrics = appSchema.table(
  'field_intelligence_dashboard_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    metricKey: varchar('metric_key', { length: 100 }).notNull(),
    metricValue: jsonb('metric_value').notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow(),
    companyId: integer('company_id')
      .notNull()
      .references(() => company.companyId),
    tenantId: uuid('tenant_id').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => employees.employeeId),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);
