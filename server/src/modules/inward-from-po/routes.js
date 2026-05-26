import { Router } from 'express';
import { InwardFromPoController } from './controller.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { requireIdempotency } from '../../middleware/idempotency.js';

const router = Router();
const controller = new InwardFromPoController();

router.get('/', requirePermission('GET:/inward-from-po'), controller.getAll);
router.get('/:id', requirePermission('GET:/inward-from-po/:id'), controller.getById);
router.post('/', requirePermission('POST:/inward-from-po'), requireIdempotency, controller.create);
router.delete('/:id', requirePermission('DELETE:/inward-from-po/:id'), controller.delete);

export default router;
