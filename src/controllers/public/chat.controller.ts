import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ChatService } from '../../services/chat.service';
import { ApiError } from '../../utils/ApiError';

export const listThreads = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const threads = await ChatService.listForCustomer(req.user.sub);
  return ApiResponse.success(res, threads);
});

export const createThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const thread = await ChatService.createThread({
    customerId: req.user.sub,
    subject: req.body.subject,
    body: req.body.body,
    attachmentKey: req.body.attachmentKey,
  });
  return ApiResponse.success(res, thread, 'Conversation started', 201);
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const messages = await ChatService.listMessages(req.params.id, {
    id: req.user.sub,
    role: req.user.role,
  });
  return ApiResponse.success(res, messages);
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const message = await ChatService.sendMessage({
    threadId: req.params.id,
    senderId: req.user.sub,
    senderRole: 'customer',
    body: req.body.body,
    attachmentKey: req.body.attachmentKey,
  });
  return ApiResponse.success(res, message, 'Sent', 201);
});
