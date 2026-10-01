import { Router } from 'express';
import publicRoutes from './public';
import adminRoutes from './admin';

const root = Router();
root.use('/public', publicRoutes);
root.use('/admin', adminRoutes);

export default root;
