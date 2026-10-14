import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createPackageSchema,
  updatePackageSchema,
  packageIdParams,
  packageItemParams,
  addPackageItemSchema,
  updatePackageItemSchema,
  requestEditSchema,
  sendPackageMessageSchema,
} from '../../validators/package.validator';
import * as pkgController from '../../controllers/public/package.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.get('/', pkgController.listMine);
router.post('/', validate(createPackageSchema), pkgController.create);

router.get('/:id', validate(packageIdParams), pkgController.getMine);
router.patch('/:id', validate(updatePackageSchema), pkgController.update);
router.delete('/:id', validate(packageIdParams), pkgController.remove);
router.post('/:id/submit', validate(packageIdParams), pkgController.submit);
router.post('/:id/request-edit', validate(requestEditSchema), pkgController.requestEdit);

router.post('/:id/items', validate(addPackageItemSchema), pkgController.addItem);
router.patch('/:id/items/:itemId', validate(updatePackageItemSchema), pkgController.updateItem);
router.delete('/:id/items/:itemId', validate(packageItemParams), pkgController.removeItem);

router.get('/:id/messages', validate(packageIdParams), pkgController.listMessages);
router.post('/:id/messages', validate(sendPackageMessageSchema), pkgController.sendMessage);

export default router;
