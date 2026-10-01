import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import * as staffController from '../../controllers/public/staff.controller';

const router = Router();

router.use(authenticate, requireRole('staff'));

router.post('/change-password', staffController.changePassword);
router.get('/my-stock', staffController.myStock);

export default router;
