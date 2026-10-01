import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { sendMessageSchema, threadIdParams } from '../../validators/chat.validator';
import * as chatController from '../../controllers/admin/chat.controller';

const router = Router();
router.get('/', chatController.list);
router.get('/:id/messages', validate(threadIdParams), chatController.listMessages);
router.post('/:id/reply', validate(sendMessageSchema), chatController.reply);
router.patch('/:id/close', validate(threadIdParams), chatController.close);
export default router;
