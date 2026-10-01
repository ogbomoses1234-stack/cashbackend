import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { disputeUpdateSchema } from '../../validators/admin.validator';
import * as disputeController from '../../controllers/admin/dispute.controller';

const router = Router();
router.get('/', disputeController.list);
router.patch('/:id', validate(disputeUpdateSchema), disputeController.update);
export default router;
