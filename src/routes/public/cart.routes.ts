import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  addToCartSchema,
  updateCartSchema,
  cartItemParams,
} from '../../validators/cart.validator';
import * as cartController from '../../controllers/public/cart.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.get('/', cartController.list);
router.post('/items', validate(addToCartSchema), cartController.add);
router.patch('/items/:id', validate(updateCartSchema), cartController.update);
router.delete('/items/:id', validate(cartItemParams), cartController.remove);
router.delete('/', cartController.clear);

export default router;
