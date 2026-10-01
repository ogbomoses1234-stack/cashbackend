import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { deactivateUserSchema, idParams } from '../../validators/admin.validator';
import * as userController from '../../controllers/admin/user.controller';

const router = Router();
router.get('/', userController.list);
router.get('/:id', validate(idParams), userController.get);
router.patch('/:id/deactivate', validate(deactivateUserSchema), userController.deactivate);
router.patch('/:id/reactivate', validate(idParams), userController.reactivate);
router.patch('/:id/reset-password', validate(idParams), userController.resetPassword);
router.delete('/:id/purge', validate(idParams), userController.purge);
export default router;
