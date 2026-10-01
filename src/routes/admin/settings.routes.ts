import { Router } from 'express';
import * as settingsController from '../../controllers/admin/settings.controller';

const router = Router();
router.get('/', settingsController.getSettings);
router.patch('/', settingsController.updateSetting);
export default router;
