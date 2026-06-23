import { Router } from 'express';
import { TestCertificateController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validateCreateTestCertificate, validateUpdateTestCertificate } from './validators.js';

const router = Router();
const controller = new TestCertificateController();

// 1. Completed batches (Read-only list & details)
router.get(
  '/completed-batches',
  requirePermission('GET:/test-certificates/completed-batches'),
  controller.getCompletedBatches
);

router.get(
  '/completed-batches/:id',
  requirePermission('GET:/test-certificates/completed-batches/:id'),
  controller.getCompletedBatchDetails
);

// 2. Test Certificates CRUD
router.get('/', requirePermission('GET:/test-certificates'), controller.getTestCertificatesList);

router.get(
  '/:id',
  requirePermission('GET:/test-certificates/:id'),
  controller.getTestCertificateDetails
);

router.post(
  '/',
  requirePermission('POST:/test-certificates'),
  validateCreateTestCertificate,
  controller.createTestCertificate
);

router.put(
  '/:id',
  requirePermission('PUT:/test-certificates/:id'),
  validateUpdateTestCertificate,
  controller.updateTestCertificate
);

router.delete(
  '/:id',
  requirePermission('DELETE:/test-certificates/:id'),
  controller.deleteTestCertificate
);

export const testCertificateRoutes = router;
export default router;
