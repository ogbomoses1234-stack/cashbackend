import { Router } from 'express';
import { getMetrics, debugMetrics } from '../../controllers/admin/dashboard.controller';

const router = Router();

/* GET /api/admin/dashboard/metrics */
router.get('/metrics', getMetrics);

/* GET /api/admin/dashboard/debug  (dev only) */
router.get('/debug', debugMetrics);

export default router;
