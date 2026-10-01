import { Router } from 'express';
import * as logController from '../../controllers/admin/log.controller';

const router = Router();
router.get('/', logController.list);
export default router;
