-- Migration SQL Script: Create Test Certificate Tables
-- Target Schema: app
-- Dialect: PostgreSQL
-- Note: Do NOT execute this script directly on live database; run via migration pipeline after approval.

-- 1. Create app.test_certificates table
CREATE TABLE IF NOT EXISTS app.test_certificates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES app.company(company_id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,
  certificate_no VARCHAR(100) NOT NULL UNIQUE,
  batch_id INTEGER NOT NULL REFERENCES app.production_batches_enhanced(batch_id) ON DELETE RESTRICT,
  batch_number VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  colour VARCHAR(100),
  manufacturing_date TIMESTAMP WITH TIME ZONE,
  testing_date TIMESTAMP WITH TIME ZONE,
  remarks TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  created_by INTEGER REFERENCES app.employees(employee_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance and multi-tenant security
CREATE INDEX IF NOT EXISTS idx_test_certificates_tenant_company ON app.test_certificates(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_test_certificates_batch_id ON app.test_certificates(batch_id);

-- 2. Create app.test_certificate_results table
CREATE TABLE IF NOT EXISTS app.test_certificate_results (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES app.test_certificates(id) ON DELETE CASCADE,
  property_name VARCHAR(150) NOT NULL,
  result_value VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_test_certificate_results_cert_id ON app.test_certificate_results(certificate_id);
