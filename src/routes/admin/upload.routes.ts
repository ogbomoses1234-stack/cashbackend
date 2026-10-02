import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { presignSchema, commitSchema } from '../../validators/upload.validator';
import * as uploadController from '../../controllers/public/upload.controller';

const router = Router();

/* Same handlers as public, but mounted with admin auth.
   The controller reads req.user || req.admin. */
router.post('/presign', validate(presignSchema), uploadController.requestPresign);
router.post('/commit', validate(commitSchema), uploadController.commitUpload);
router.get('/:objectKey/signed', uploadController.getSignedUrl);

export default router;
