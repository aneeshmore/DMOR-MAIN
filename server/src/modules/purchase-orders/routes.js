import { Router } from 'express';
import { PurchaseOrdersController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireIdempotency } from '../../middleware/idempotency.js';

const router = Router();
const controller = new PurchaseOrdersController();

router.get('/', requirePermission('GET:/purchase-orders'), controller.getAllPurchaseOrders);
router.get('/:id', requirePermission('GET:/purchase-orders/:id'), controller.getPurchaseOrderById);
router.post(
  '/',
  requirePermission('POST:/purchase-orders'),
  requireIdempotency,
  controller.createPurchaseOrder
);
router.put('/:id', requirePermission('PUT:/purchase-orders/:id'), controller.updatePurchaseOrder);
router.delete(
  '/:id',
  requirePermission('DELETE:/purchase-orders/:id'),
  controller.deletePurchaseOrder
);

export default router;
