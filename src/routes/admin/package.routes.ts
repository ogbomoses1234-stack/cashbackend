import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
  adminPackageListQuery,
  adminPackageIdParams,
  adminSetStatusSchema,
  adminSetQuoteSchema,
  adminResolveEditSchema,
  adminPackageReplySchema,
} from '../../validators/admin-package.validator';
import * as pkgController from '../../controllers/admin/package.controller';

const router = Router();

router.get('/', validate(adminPackageListQuery), pkgController.list);
router.get('/:id', validate(adminPackageIdParams), pkgController.get);

router.post('/:id/reply', validate(adminPackageReplySchema), pkgController.reply);
router.patch('/:id/status', validate(adminSetStatusSchema), pkgController.setStatus);
router.patch('/:id/quote', validate(adminSetQuoteSchema), pkgController.setQuote);
router.patch(
  '/:id/edit-requests/:editId',
  validate(adminResolveEditSchema),
  pkgController.resolveEdit
);

export default router;
