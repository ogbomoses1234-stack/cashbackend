import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { verifyOtpSchema, resendOtpSchema } from '../../validators/auth.validator';
import * as otpController from '../../controllers/public/otp.controller';

const router = Router();

const otpLimiter = rateLimit({
  keyPrefix: 'rl:otp',
  maxHits: 3,
  windowSecs: 3600,
  by: (req) => (req.body?.email || req.ip || 'anon').toString().toLowerCase(),
});

router.post('/verify', otpLimiter, validate(verifyOtpSchema), otpController.verifySignupOtp);
router.post('/resend', otpLimiter, validate(resendOtpSchema), otpController.resendOtp);

export default router;
