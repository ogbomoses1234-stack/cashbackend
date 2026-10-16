import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { updateNotificationPrefsSchema } from '../../validators/notification.validator';
import * as settingsController from '../../controllers/admin/settings.controller';

const router = Router();

/* Generic settings */
router.get('/', settingsController.getSettings);
router.patch('/', settingsController.updateSetting);

/* Admin notification preferences */
router.get('/notifications', settingsController.getNotificationPrefs);
router.patch(
  '/notifications',
  validate(updateNotificationPrefsSchema),
  settingsController.updateNotificationPrefs
);

export default router;