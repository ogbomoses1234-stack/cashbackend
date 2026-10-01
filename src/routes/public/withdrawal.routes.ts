import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createWithdrawalSchema } from '../../validators/withdrawal.validator';
import * as withdrawalController from '../../controllers/public/withdrawal.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.post('/', validate(createWithdrawalSchema), withdrawalController.create);
router.get('/', withdrawalController.listMine);

export default router;
