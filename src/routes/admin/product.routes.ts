import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  idParams,
  featureToggleSchema,
} from '../../validators/admin.validator';
import * as productController from '../../controllers/admin/product.controller';

const router = Router();

router.get('/', productController.list);
router.post('/', validate(createProductSchema), productController.create);
router.patch('/:id', validate(updateProductSchema), productController.update);
router.patch(
  '/:id/feature',
  validate(featureToggleSchema),
  productController.featureToggle
);
router.delete('/:id', validate(idParams), productController.remove);

export default router;
