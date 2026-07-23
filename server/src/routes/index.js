import { Router } from 'express';
import express from 'express';
import path from 'path';
import { authenticate } from '../middleware/auth.js';

// Feature modules (modular architecture with AppError and proper DTOs)
import { authorityRoutes } from '../modules/authority/index.js';
import { ordersRoutes } from '../modules/orders/index.js';
import accountsRoutes from '../modules/accounts/routes.js';
import { inventoryRoutes } from '../modules/inventory/index.js';
import { productionRoutes as productionModuleRoutes } from '../modules/production/index.js';
import { employeesRoutes } from '../modules/employees/index.js';
import { bomRoutes as bomModuleRoutes } from '../modules/bom/index.js';
import { mastersRoutes } from '../modules/masters/index.js';
import { dashboardRoutes as dashboardModuleRoutes } from '../modules/dashboard/index.js';
import { masterProductsRoutes } from '../modules/master-products/index.js';
import { adminAccountsRoutes } from '../modules/admin-accounts/index.js';
import { pmOrdersRoutes } from '../modules/pm-orders/index.js';
import { inwardRoutes } from '../modules/Inward/index.js';
import { discardRoutes } from '../modules/Discard/index.js';
import { dispatchPlanningRoutes } from '../modules/dispatch-planning/index.js';
import { splitOrdersRoutes } from '../modules/split-orders/index.js';
import productionManagerRoutes from '../modules/production-manager/routes.js';
import productionSupervisorRoutes from '../modules/production-supervisor/routes.js';
import notificationsRoutes from '../modules/notifications/index.js';
import reportsRoutes from '../modules/reports/routes.js';
import { productDevelopmentRoutes } from '../modules/product-development/index.js';
import { deliveryCompleteRoutes } from '../modules/delivery-complete/index.js';
import { suppliersRoutes } from '../modules/suppliers/index.js';
import { updateProductRoutes } from '../modules/update-product/index.js';
import { tncRoutes } from '../modules/tnc/index.js';
import { quotationsRoutes } from '../modules/quotations/index.js';
import { crmRoutes } from '../modules/crm/index.js';
import { cancelOrderRoutes } from '../modules/cancel-order/index.js';
import { paymentRoutes } from '../modules/payments/index.js';
import { companyRoutes } from '../modules/company/index.js';
import { purchaseOrdersRoutes } from '../modules/purchase-orders/index.js';
import { inwardFromPoRoutes } from '../modules/inward-from-po/index.js';
import { fieldIntelligenceRoutes } from '../modules/field-intelligence/index.js';
import { testCertificateRoutes } from '../modules/test-certificate/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================
router.use('/auth', authorityRoutes);

// Health check endpoint (public for monitoring)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Morex Technologies API is running',
    version: '2.0.0',
    architecture: 'Modular Feature-based',
    orm: 'Drizzle ORM',
    database: 'Neon PostgreSQL',
    timestamp: new Date().toISOString(),
  });
});

// Serve static uploads before authentication so they can be accessed publicly via <img> tags
router.use('/uploads', express.static(path.resolve('uploads')));

// ============================================
// PROTECTED ROUTES (All require authentication)
// ============================================
router.use(authenticate);

// Core feature routes
router.use('/orders', ordersRoutes);
router.use('/accounts', accountsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/production-batches', productionModuleRoutes);
router.use('/employees', employeesRoutes);
router.use('/bom', bomModuleRoutes);
router.use('/masters', mastersRoutes);
router.use('/dashboard', dashboardModuleRoutes);
router.use('/catalog', masterProductsRoutes);
router.use('/admin-accounts', adminAccountsRoutes);
router.use('/pm-orders', pmOrdersRoutes);
router.use('/inward', inwardRoutes);
router.use('/discard', discardRoutes);
router.use('/dispatch-planning', dispatchPlanningRoutes);
router.use('/split-orders', splitOrdersRoutes);
router.use('/production-manager', productionManagerRoutes);
router.use('/production-supervisor', productionSupervisorRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/reports', reportsRoutes);
router.use('/product-development', productDevelopmentRoutes);
router.use('/delivery-complete', deliveryCompleteRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/update-product', updateProductRoutes);
router.use('/tnc', tncRoutes);
router.use('/crm', crmRoutes);
router.use('/cancel-order', cancelOrderRoutes);
router.use('/quotations', quotationsRoutes);
router.use('/payments', paymentRoutes);
router.use('/company', companyRoutes);
router.use('/purchase-orders', purchaseOrdersRoutes);
router.use('/inward-from-po', inwardFromPoRoutes);
router.use('/field-intelligence', fieldIntelligenceRoutes);
router.use('/test-certificates', testCertificateRoutes);

export default router;
