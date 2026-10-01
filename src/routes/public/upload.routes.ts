import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { presignSchema, commitSchema } from '../../validators/upload.validator';
import * as uploadController from '../../controllers/public/upload.controller';

const router = Router();

router.use(authenticate);

router.post('/presign', validate(presignSchema), uploadController.requestPresign);
router.post('/commit', validate(commitSchema), uploadController.commitUpload);
router.get('/:objectKey/signed', uploadController.getSignedUrl);

export default router;
