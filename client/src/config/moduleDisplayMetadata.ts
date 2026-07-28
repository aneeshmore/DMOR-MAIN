/**
 * Central module display metadata.
 *
 * Single source of truth for user-facing module titles and card descriptions.
 * Keyed by the STABLE route path exactly as declared in `routeRegistry.tsx`.
 *
 * IMPORTANT
 * - This file changes DISPLAY TEXT ONLY.
 * - Route paths, route ids, permission modules/ids and any stored values
 *   (e.g. "Page After Login") are unaffected and must keep using the path key.
 * - `aliases` hold previous display names so sidebar search still matches what
 *   users are used to typing. Aliases are never rendered.
 * - Titles are stored as normal text (e.g. "Sales Orders & Quotations").
 *   Never write HTML entities such as &amp; here - React escapes text on render.
 */

export type ModuleDisplayMetadata = {
  title: string;
  description?: string;
  aliases?: string[];
};

export const moduleDisplayMetadata: Record<string, ModuleDisplayMetadata> = {
  // ---------------------------------------------------------------- Masters
  '/masters/departments': {
    title: 'Departments & Roles',
    description: 'Manage departments, job roles, and responsibilities',
    aliases: ['Department', 'Departments'],
  },
  '/masters/notifications': {
    title: 'Alerts & Notifications',
    description: 'Configure stock, approval, and system alerts',
    aliases: ['Notification Management', 'Notifications'],
  },
  '/masters/employees': {
    title: 'Employee Directory',
    description: 'Manage employee and user records',
    aliases: ['Employee Master', 'Employees'],
  },
  '/masters/units': {
    title: 'Units of Measure',
    description: 'Manage litres, kilograms, drums, packs, and other units',
    aliases: ['Unit Master', 'Units'],
  },
  '/masters/master-product': {
    title: 'Paint Product Catalogue',
    description: 'Manage paint families, brands, and product ranges',
    aliases: ['Product Master', 'Master Product'],
  },
  '/masters/product-sub-master': {
    title: "Product Variants & SKU's",
    description: 'Manage shades, pack sizes, finishes, and product variants',
    aliases: ['Sub Product Master', 'Product Sub Master'],
  },
  '/masters/terms': {
    title: 'Quotation Terms',
    description: 'Manage standard commercial terms and conditions',
    aliases: ['Quotation Terms and Conditions', 'Terms'],
  },
  '/masters/customers': {
    title: 'Customers',
    description: 'Add and manage dealers, distributors, and other customers',
    aliases: ['Add New Customer', 'Customer Master'],
  },
  '/masters/customer-types': {
    title: 'Customer Categories',
    description: 'Manage dealers, distributors, contractors, OEMs, and retailers',
    aliases: ['Customer Type Master', 'Customer Types'],
  },
  '/masters/suppliers': {
    title: 'Suppliers & Vendors',
    description: 'Manage raw-material, packaging, and service suppliers',
    aliases: ['Create Vendor/Supplier', 'Supplier Master', 'Vendors'],
  },
  '/masters/development': {
    title: '1K Formulation Development',
    description: 'Develop single-component paint formulations',
    aliases: ['1K Product Development'],
  },
  '/masters/double-development': {
    title: '2K Formulation Development',
    description: 'Develop two-component paint formulations',
    aliases: ['2K Product Development'],
  },
  '/masters/update-product': {
    title: 'Product Specifications & Revisions',
    description: 'Update formulations, specifications, and product details',
    aliases: ['Update Product'],
  },
  '/company-details': {
    title: 'Company Profile',
    description: 'Manage company, plant, and contact information',
    aliases: ['Company Details'],
  },

  // ------------------------------------------------------------- Operations
  '/operations/create-order': {
    title: 'Sales Orders & Quotations',
    description: 'Create and manage customer quotations and sales orders',
    aliases: ['Create & Manage Orders/Quotations', 'Create Order'],
  },
  '/operations/purchase-orders': {
    title: 'Purchase Orders',
    description: 'Create and manage supplier purchase orders',
    aliases: ['Create Purchase Order'],
  },
  '/operations/inward-from-po': {
    title: 'Material Receipt Against PO',
    description: 'Receive materials against approved purchase orders',
    aliases: ['Inward From PO'],
  },
  '/operations/quotation-requests': {
    title: 'Quotation Review & Approval',
    description: 'Verify quotation details and approve or reject quotations',
    aliases: ['Quotation Requests'],
  },
  '/operations/admin-accounts': {
    title: 'Credit & Order Approval',
    description: 'Review customer credit and approve sales orders',
    aliases: ['Order Approval by Accounts', 'Order Approval'],
  },
  '/operations/payment-entry': {
    title: 'Customer Payment Entry',
    description: 'Record and track customer payments',
    aliases: ['Payment Entry'],
  },
  '/operations/accept-orders': {
    title: 'Factory Order Confirmation',
    description: 'Confirm customer orders for production',
    aliases: ['Accept Order at Factory', 'Accept Orders'],
  },
  '/operations/pm-dashboard': {
    title: 'Production Planning Dashboard',
    description: 'View production workload, priorities, and order status',
    aliases: ['PM Dashboard'],
  },
  '/operations/dispatch-planning': {
    title: 'Dispatch Planning',
    description: 'Plan finished-goods dispatches and deliveries',
  },
  '/operations/delivery-complete': {
    title: 'Sales Returns',
    description: 'Record and process returned finished goods',
    aliases: ['Return Delivery', 'Delivery Complete'],
  },
  '/operations/cancel-order': {
    title: 'Order Cancellation',
    description: 'Cancel pending or confirmed customer orders',
    aliases: ['Cancel Order'],
  },
  '/operations/create-batch': {
    title: 'Production Batches',
    description: 'Create, schedule, and manage manufacturing batches',
    aliases: ['Create & Manage Batch', 'Create Batch'],
  },
  '/operations/pm-inward': {
    title: 'All Material Inward',
    description:
      'Record inward entries for raw materials, packaging materials, consumables, and other supplies',
  },
  '/operations/split-order': {
    title: 'Split Production Order',
    description: 'Divide an order into multiple production batches',
    aliases: ['PM-Split Order', 'Split Order'],
  },
  '/operations/discard': {
    title: 'Material Scrap & Disposal',
    description: 'Record rejected, expired, damaged, or discarded materials',
    aliases: ['Admin - Material Discard', 'Material Discard'],
  },
  '/operations/smart-crm': {
    title: 'Customer & Sales Management',
    description: 'Manage customers, enquiries, follow-ups, and sales activities',
    aliases: ['Smart CRM', 'SMART CRM', 'CRM'],
  },
  '/operations/test-certificate': {
    title: 'Generate Test Certificate / CoA',
    description: 'Instantly generate a batch-wise test certificate or Certificate of Analysis',
    aliases: ['Test Certificate'],
  },

  // ---------------------------------------------------------------- Reports
  '/reports/batch-production': {
    title: 'Production Batch Summary – Accounts',
    description: 'View completed production batches for accounts and costing review',
    aliases: ['Batch Reports For Accounts', 'Batch Reports for Accounts'],
  },
  '/reports/new-batch-production': {
    title: 'Production Batch Report',
    description: 'View batch-wise production details and manufacturing status',
    aliases: ['Batch Report'],
  },
  '/reports/salesperson-revenue': {
    title: 'Salesperson-wise Sales Report',
    description: 'View sales value and performance by salesperson',
    aliases: ['Salesperson Revenue Report'],
  },
  '/reports/payments': {
    title: 'Customer Payment Report',
    description: 'View customer payments, outstanding amounts, and payment history',
    aliases: ['Payment Report'],
  },
  '/reports/material-inward': {
    title: 'Material Inward Report',
    description: 'View inward records for raw materials, packaging, and other supplies',
    aliases: ['Material Inward'],
  },
  '/reports/stock': {
    title: 'Current Stock Report',
    description: 'View available stock of raw materials and finished products',
    aliases: ['Stock Report'],
  },
  '/reports/low-stock': {
    title: 'Low Stock Report',
    description: 'View materials and products below minimum stock levels',
    aliases: ['Low Stock Alert'],
  },
  '/reports/customer-contact': {
    title: 'Customer Contact List',
    description: 'View customer names, phone numbers, email addresses, and locations',
    aliases: ['Customer Contact Report'],
  },
  '/reports/profit-loss': {
    title: 'Profit & Loss Report',
    description: 'View income, expenses, and overall profit or loss',
    aliases: ['P/L Statement', 'Profit Loss'],
  },
  '/reports/customer-sales': {
    title: 'Customer-wise Sales Report',
    description: 'View sales quantities and values for each customer',
    aliases: ['Customer Sales Report'],
  },
  '/reports/cancelled-orders': {
    title: 'Cancelled Orders Report',
    description: 'View cancelled customer orders and cancellation details',
    aliases: ['Cancel Order Report'],
  },
  '/reports/product-wise': {
    title: 'Product-wise Sales Report',
    description: 'View sales quantities, values, and performance by product',
    aliases: ['Product Wise Report'],
  },
  '/reports/daily-consumption': {
    title: 'Daily Material Consumption Report',
    description: 'View daily usage of raw materials and packaging materials',
    aliases: ['Daily Consumption'],
  },
  '/reports/dispatch': {
    title: 'Dispatch & Delivery Report',
    description: 'View dispatched orders, quantities, transport, and delivery status',
    aliases: ['Dispatch Report'],
  },
  '/reports/test-certificate': {
    title: 'Test Certificate / CoA Records',
    description: 'View and download approved batch test certificates',
    aliases: ['Test Certificate Report'],
  },
};

/**
 * Friendly title for a route path.
 * Falls back to the caller's existing label so unmapped routes are unchanged
 * and never render blank/undefined text.
 */
export function getModuleTitleByPath(path?: string | null, fallback?: string): string {
  if (!path) return fallback ?? '';
  return moduleDisplayMetadata[path]?.title ?? fallback ?? '';
}

/** Card description for a route path, or the provided fallback. */
export function getModuleDescriptionByPath(path?: string | null, fallback?: string): string {
  if (!path) return fallback ?? '';
  return moduleDisplayMetadata[path]?.description ?? fallback ?? '';
}

/** Legacy display names kept for search matching only (never rendered). */
export function getModuleAliasesByPath(path?: string | null): string[] {
  if (!path) return [];
  return moduleDisplayMetadata[path]?.aliases ?? [];
}

export default moduleDisplayMetadata;
