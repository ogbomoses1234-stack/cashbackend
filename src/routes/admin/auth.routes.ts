import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { adminAuthenticate } from '../../middleware/admin-auth.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { adminLoginSchema, adminVerifyOtpSchema } from '../../validators/auth.validator';
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
router.post('/logout', adminAuthenticate, adminAuthController.logout);
router.get('/me', adminAuthenticate, adminAuthController.me);

export default router;
