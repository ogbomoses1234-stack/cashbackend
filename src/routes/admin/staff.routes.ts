import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { createStaffSchema, updateStaffSchema, idParams } from '../../validators/admin.validator';
import * as staffController from '../../controllers/admin/staff.controller';

const router = Router();
router.get('/', staffController.list);
router.post('/', validate(createStaffSchema), staffController.create);
router.patch('/:id', validate(updateStaffSchema), staffController.update);
router.patch('/:id/reset-password', validate(idParams), staffController.resetPassword);
router.patch('/:id/deactivate', validate(idParams), staffController.deactivate);
export default router;
