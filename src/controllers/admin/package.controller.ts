import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { PackageService } from '../../services/package.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.validatedQuery ?? req.query;
  const result = await PackageService.listAdmin({
    status: q.status,
    search: q.search,
    page: q.page,
    perPage: q.perPage,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const row = await PackageService.getAdmin(req.params.id);
  return ApiResponse.success(res, row);
});

export const reply = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const msg = await PackageService.replyAsAdmin(req.admin.sub, req.params.id, req.body.body, req.body.attachmentKey);
  return ApiResponse.success(res, msg, 'Reply sent', 201);
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const row = await PackageService.setStatus(req.admin.sub, req.params.id, req.body.status, req.body.reason);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'package.status_changed',
    entityType: 'package',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { status: req.body.status, reason: req.body.reason },
  });
  return ApiResponse.success(res, row, 'Status updated');
});

export const setQuote = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const row = await PackageService.setQuote(req.params.id, req.body.quotedTotal, req.body.currency);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'package.quote_set',
    entityType: 'package',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { quotedTotal: req.body.quotedTotal },
  });
  return ApiResponse.success(res, row, 'Quote saved');
});

export const resolveEdit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const edit = await PackageService.resolveEditRequest(
    req.admin.sub,
    req.params.id,
    req.params.editId,
    req.body.status,
    req.body.adminNote
  );
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: `package.edit_${req.body.status}`,
    entityType: 'package',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { editId: req.params.editId, adminNote: req.body.adminNote },
  });
  return ApiResponse.success(res, edit, `Edit request ${req.body.status}`);
});
