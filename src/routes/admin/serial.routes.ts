import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { generateSerialsSchema } from '../../validators/admin.validator';
import * as serialController from '../../controllers/admin/serial.controller';

const router = Router();

/* Specific paths first — before any /:param wildcards */
router.post('/generate', validate(generateSerialsSchema), serialController.generate);
router.get('/tracker', serialController.listTracker);
router.get('/batch/:batchId', serialController.listByBatch);
router.get('/archive/:batchId', serialController.downloadArchive);

/* Generic — MUST be last */
router.get('/:serialNumber', serialController.getTrackerDetail);

export default router;
