import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { PackageService } from '../../services/package.service';
import { ApiError } from '../../utils/ApiError';

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await PackageService.listMine(req.user.sub);
  return ApiResponse.success(res, items);
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const row = await PackageService.getMine(req.user.sub, req.params.id);
  return ApiResponse.success(res, row);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const row = await PackageService.create(req.user.sub, req.body);
  return ApiResponse.success(res, row, 'List created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const row = await PackageService.update(req.user.sub, req.params.id, req.body);
  return ApiResponse.success(res, row, 'List updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await PackageService.delete(req.user.sub, req.params.id);
  return ApiResponse.success(res, { deleted: true });
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const row = await PackageService.submit(req.user.sub, req.params.id);
  return ApiResponse.success(res, row, 'List submitted');
});

export const requestEdit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const edit = await PackageService.requestEdit(req.user.sub, req.params.id, req.body.reason);
  return ApiResponse.success(res, edit, 'Edit request sent', 201);
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await PackageService.addItem(req.user.sub, req.params.id, req.body);
  return ApiResponse.success(res, item, 'Item added', 201);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await PackageService.updateItem(req.user.sub, req.params.id, req.params.itemId, req.body);
  return ApiResponse.success(res, item, 'Item updated');
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await PackageService.removeItem(req.user.sub, req.params.id, req.params.itemId);
  return ApiResponse.success(res, { deleted: true });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await PackageService.listMessages(req.user.sub, req.params.id);
  return ApiResponse.success(res, items);
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const msg = await PackageService.sendMessage(req.user.sub, req.params.id, req.body.body, req.body.attachmentKey);
  return ApiResponse.success(res, msg, 'Sent', 201);
});
