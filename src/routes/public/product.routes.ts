import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { listProductsQuery, productSlugParams } from '../../validators/product.validator';
import * as productController from '../../controllers/public/product.controller';

const router = Router();

router.get('/', validate(listProductsQuery), productController.list);
router.get('/:slug', validate(productSlugParams), productController.getBySlug);

export default router;
