import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { idParams, flagOrderSchema } from '../../validators/admin.validator';
import * as orderController from '../../controllers/admin/order.controller';

const router = Router();
router.get('/', orderController.list);
router.get('/:id', validate(idParams), orderController.get);
router.patch('/:id/approve', validate(idParams), orderController.approve);
router.patch('/:id/flag', validate(flagOrderSchema), orderController.flag);
router.get(
  '/:id/receipt-url',
  validate(idParams),
  orderController.getReceiptUrl
);

export default router;
