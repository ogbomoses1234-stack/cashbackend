import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ChatService } from '../../services/chat.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await ChatService.listAll({
    status: q.status,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const messages = await ChatService.listMessages(req.params.id, {
    id: req.admin.sub,
    role: 'admin',
  });
  return ApiResponse.success(res, messages);
});

export const reply = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const message = await ChatService.sendMessage({
    threadId: req.params.id,
    senderId: req.admin.sub,
    senderRole: 'admin',
    body: req.body.body,
    attachmentKey: req.body.attachmentKey,
  });
  return ApiResponse.success(res, message, 'Reply sent', 201);
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const thread = await ChatService.closeThread(req.params.id);
  return ApiResponse.success(res, thread, 'Thread closed');
});
