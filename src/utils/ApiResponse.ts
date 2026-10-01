import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, data: T, message = 'OK', status = 200) {
    return res.status(status).json({ success: true, message, data });
  }

  static error(res: Response, statusCode: number, code: string, message: string, details?: unknown) {
    return res.status(statusCode).json({
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    });
  }

  static paginated<T>(
    res: Response,
    items: T[],
    meta: { page: number; perPage: number; total: number },
    message = 'OK'
  ) {
    return res.json({
      success: true,
      message,
      data: items,
      meta: { ...meta, totalPages: Math.ceil(meta.total / meta.perPage) },
    });
  }
}
