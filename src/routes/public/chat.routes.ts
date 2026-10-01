import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createThreadSchema,
  sendMessageSchema,
  threadIdParams,
} from '../../validators/chat.validator';
import * as chatController from '../../controllers/public/chat.controller';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.get('/threads', chatController.listThreads);
router.post('/threads', validate(createThreadSchema), chatController.createThread);
router.get(
  '/threads/:id/messages',
  validate(threadIdParams),
  chatController.listMessages
);
router.post(
  '/threads/:id/messages',
  validate(sendMessageSchema),
  chatController.sendMessage
);

export default router;
