import { Router } from 'express';
import { DispatchPlanningController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireIdempotency } from '../../middleware/idempotency.js';

const router = Router();
const controller = new DispatchPlanningController();

router.get(
  '/queue',
  requirePermission('GET:/dispatch-planning/queue'),
  controller.getDispatchQueue
);
router.get(
  '/returned-queue',
  requirePermission('GET:/dispatch-planning/returned-queue'),
  controller.getReturnedQueue
);
router.get(
  '/vehicles',
  requirePermission('GET:/dispatch-planning/vehicles'),
  controller.getVehicles
);
// Guarded by the dispatch-create permission: creating a dispatch already
// creates vehicles implicitly (ensureVehicleExists), so the audience is identical
// and no new permission grants are required for existing roles.
router.post(
  '/vehicles',
  requirePermission('POST:/dispatch-planning/create'),
  controller.addVehicle
);
router.post(
  '/create',
  requirePermission('POST:/dispatch-planning/create'),
  requireIdempotency,
  controller.createDispatch
);
router.patch(
  '/:orderId/requeue',
  requirePermission('PATCH:/dispatch-planning/:id/requeue'),
  controller.requeueOrder
);
router.get(
  '/:id/details',
  requirePermission('GET:/dispatch-planning/:id/details'),
  controller.getDispatchDetails
);

export default router;
