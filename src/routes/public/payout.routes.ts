import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { verifyAccountQuery, savePayoutSchema } from '../../validators/payout.validator';
import * as payoutController from '../../controllers/public/payout.controller';

const router = Router();

router.use(authenticate);
router.get('/banks', payoutController.listBanks);
router.get('/verify', validate(verifyAccountQuery), payoutController.verifyAccount);

router.get('/', payoutController.getPayout);
router.post('/', validate(savePayoutSchema), payoutController.savePayout);

export default router;
