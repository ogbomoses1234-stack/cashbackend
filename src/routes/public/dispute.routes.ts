import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createDisputeSchema } from '../../validators/dispute.validator';
import * as disputeController from '../../controllers/public/dispute.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.post('/', validate(createDisputeSchema), disputeController.create);
router.get('/', disputeController.listMine);

export default router;
