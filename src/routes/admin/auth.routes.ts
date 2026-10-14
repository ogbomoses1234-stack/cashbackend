import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { adminAuthenticate } from '../../middleware/admin-auth.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import {
  adminLoginSchema,
  adminVerifyOtpSchema,
  adminRefreshSchema,
} from '../../validators/auth.validator';
import * as adminAuthController from '../../controllers/admin/auth.controller';

const router = Router();

const loginLimiter = rateLimit({
  keyPrefix: 'rl:admin:login',
  maxHits: 10,
  windowSecs: 300,
});

router.post('/login', loginLimiter, validate(adminLoginSchema), adminAuthController.login);
router.post(
  '/verify-otp',
  loginLimiter,
  validate(adminVerifyOtpSchema),
  adminAuthController.verifyOtp
);

/* Public refresh — no auth (that's the whole point) */
router.post('/refresh', validate(adminRefreshSchema), adminAuthController.refresh);

/* Logout accepts optional auth — revokes whatever it can */
router.post('/logout', adminAuthController.logout);

router.get('/me', adminAuthenticate, adminAuthController.me);

export default router;