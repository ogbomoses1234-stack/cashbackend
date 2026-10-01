import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { DisputeService } from '../../services/dispute.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await DisputeService.listAdmin({
    status: q.status,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await DisputeService.updateStatus(
    req.params.id,
    req.body.status,
    req.body.adminNote
  );
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'dispute.updated',
    entityType: 'dispute',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { status: req.body.status },
  });
  return ApiResponse.success(res, result, 'Dispute updated');
});
