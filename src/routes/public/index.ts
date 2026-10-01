import { Router } from 'express';
import authRoutes from './auth.routes';
import otpRoutes from './otp.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import bannerRoutes from './banner.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import walletRoutes from './wallet.routes';
import withdrawalRoutes from './withdrawal.routes';
import payoutRoutes from './payout.routes';
import scanRoutes from './scan.routes';
import disputeRoutes from './dispute.routes';
import chatRoutes from './chat.routes';
import uploadRoutes from './upload.routes';
import staffRoutes from './staff.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/otp', otpRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/banners', bannerRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/wallet', walletRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/payout', payoutRoutes);
router.use('/scan', scanRoutes);
router.use('/disputes', disputeRoutes);
router.use('/chat', chatRoutes);
router.use('/uploads', uploadRoutes);
router.use('/staff', staffRoutes);

export default router;
