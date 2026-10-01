import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createOrderSchema, orderIdParams } from '../../validators/order.validator';
import * as orderController from '../../controllers/public/order.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.post('/', validate(createOrderSchema), orderController.create);
router.get('/', orderController.listMine);
router.get('/:id', validate(orderIdParams), orderController.getMine);

export default router;
