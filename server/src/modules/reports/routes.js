import { Router } from 'express';
import * as reportsController from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';

const router = Router();

router.get(
  '/batch-production',
  requirePermission('GET:/reports/batch-production'),
  reportsController.getBatchProductionReport
);
router.get(
  '/daily-consumption',
  requirePermission('GET:/reports/daily-consumption'),
  reportsController.getDailyConsumptionReport
);
router.get(
  '/material-inward',
  requirePermission('GET:/reports/material-inward'),
  reportsController.getMaterialInwardReport
);
router.get('/stock', requirePermission('GET:/reports/stock'), reportsController.getStockReport);
router.get(
  '/profit-loss',
  requirePermission('GET:/reports/profit-loss'),
  reportsController.getProfitLossReport
);
router.get(
  '/product-wise',
  requirePermission('GET:/reports/product-wise'),
  reportsController.getProductWiseReport
);
router.get(
  '/order-counts-by-month',
  requirePermission('GET:/reports/order-counts'),
  reportsController.getOrderCountsByMonth
);
router.get(
  '/cancelled-orders',
  requirePermission('GET:/reports/cancelled-orders'),
  reportsController.getCancelledOrders
);


router.get(
  '/salesman-revenue',
  requirePermission('GET:/reports/salesman-revenue'),
  reportsController.getSalesmanRevenueReport
);

router.get(
  '/salesperson-incentives',
  requirePermission('GET:/reports/salesperson-incentives'),
  reportsController.getSalespersonIncentiveReport
);

router.get(
  '/dispatch',
  requirePermission('GET:/reports/dispatch'),
  reportsController.getDispatchReport
);

export default router;
