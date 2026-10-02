import { Router } from 'express';
import { adminAuthenticate } from '../../middleware/admin-auth.middleware';

import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import withdrawalRoutes from './withdrawal.routes';
import productRoutes from './product.routes';
import bannerRoutes from './banner.routes';
import serialRoutes from './serial.routes';
import orderRoutes from './order.routes';
import staffRoutes from './staff.routes';
import userRoutes from './user.routes';
import chatRoutes from './chat.routes';
import disputeRoutes from './dispute.routes';
import logRoutes from './log.routes';
import settingsRoutes from './settings.routes';
import uploadRoutes from './upload.routes';

const router = Router();

// Public admin routes (login + OTP verification)
router.use('/auth', authRoutes);

// Everything else requires admin auth
router.use(adminAuthenticate);

router.use('/dashboard', dashboardRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/products', productRoutes);
router.use('/banners', bannerRoutes);
router.use('/serials', serialRoutes);
router.use('/orders', orderRoutes);
router.use('/staff', staffRoutes);
router.use('/users', userRoutes);
router.use('/chats', chatRoutes);
router.use('/disputes', disputeRoutes);
router.use('/logs', logRoutes);
router.use('/settings', settingsRoutes);
router.use('/uploads', uploadRoutes);

export default router;
