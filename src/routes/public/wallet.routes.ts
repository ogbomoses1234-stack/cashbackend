import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import * as walletController from '../../controllers/public/wallet.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.get('/', walletController.getWallet);
router.get('/transactions', walletController.listTransactions);

export default router;
