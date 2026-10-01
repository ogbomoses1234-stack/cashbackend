import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  createBannerSchema,
  updateBannerSchema,
  bannerIdParams,
} from '../../validators/banner.validator';
import * as bannerController from '../../controllers/admin/banner.controller';

const router = Router();

router.get('/', bannerController.list);
router.post('/', validate(createBannerSchema), bannerController.create);
router.patch('/:id', validate(updateBannerSchema), bannerController.update);
router.delete('/:id', validate(bannerIdParams), bannerController.remove);

export default router;
