/**
 * Database Schema Index
 *
 * Central export point for all database schema definitions.
 * Organized by domain for better maintainability and scalability.
 *
 * Schema Structure:
 * - core: Base application schema, units, vehicles
 * - products: Master products, SKUs, BOM
 * - organization: Employees, departments, branches, designations
 * - sales: Customers, orders, order details
 * - production: Production batches and manufacturing
 * - inventory: Material movements, stock ledger
 * - auth: Roles, permissions, access control
 * - cross-domain-relations: Relationships spanning multiple domains
 */

// Core schemas
export * from './core/index.js';

// Product schemas
export * from './products/index.js';

// Organization schemas
export * from './organization/index.js';

// Sales schemas
export * from './sales/index.js';

// Production schemas
export * from './production/index.js';

// Inventory schemas
export * from './inventory/index.js';

// Auth schemas
export * from './auth/index.js';

// CRM schemas
export * from './crm/index.js';

// Test Certificate schemas
export * from './test-certificate/index.js';

// Cross-domain relations (must be imported last)
export * from './cross-domain-relations.js';
