import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { declineWithdrawalSchema, idParams } from '../../validators/admin.validator';
import * as withdrawalController from '../../controllers/admin/withdrawal.controller';

const router = Router();
router.get('/', withdrawalController.list);
router.patch('/:id/approve', validate(idParams), withdrawalController.approve);
router.patch('/:id/decline', validate(declineWithdrawalSchema), withdrawalController.decline);
router.get('/:id', withdrawalController.getWithdrawalDetail);

export default router;
