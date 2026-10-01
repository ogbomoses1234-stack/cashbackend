import { Router } from 'express';
import * as categoryController from '../../controllers/public/category.controller';

const router = Router();

router.get('/', categoryController.list);

export default router;
