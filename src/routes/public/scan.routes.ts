import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { scanRedeemSchema, staffScanSchema } from '../../validators/scan.validator';
import * as scanController from '../../controllers/public/scan.controller';

const router = Router();

router.use(authenticate);

router.post(
  '/redeem',
  requireRole('customer'),
  validate(scanRedeemSchema),
  scanController.redeem
);

router.post(
  '/staff/dispatch',
  requireRole('staff'),
  validate(staffScanSchema),
  scanController.staffDispatch
);

export default router;
