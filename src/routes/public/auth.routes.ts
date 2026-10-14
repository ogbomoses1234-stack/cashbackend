import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { checkDeviceBlocked } from '../../middleware/fingerprint.middleware';
import {
  signupSchema,
  loginSchema,
  profileSetupSchema,
  changePasswordSchema,
  refreshSchema,
} from '../../validators/auth.validator';
import * as authController from '../../controllers/public/auth.controller';

const router = Router();

router.post('/signup', checkDeviceBlocked, validate(signupSchema), authController.signup);
router.post('/login', checkDeviceBlocked, validate(loginSchema), authController.login);

/* Public refresh — no auth required (that's the whole point) */
router.post('/refresh', validate(refreshSchema), authController.refresh);

/* Logout accepts optional auth — revokes whatever it can */
router.post('/logout', authController.logout);

router.get('/me', authenticate, authController.me);
router.post(
  '/complete-profile',
  authenticate,
  validate(profileSetupSchema),
  authController.completeProfile
);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;