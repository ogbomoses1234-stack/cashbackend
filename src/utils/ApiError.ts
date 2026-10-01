export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code: string, msg: string, details?: unknown) {
    return new ApiError(400, code, msg, details);
  }
  static unauthorized(code = 'AUTH_REQUIRED', msg = 'Authentication required') {
    return new ApiError(401, code, msg);
  }
  static forbidden(code = 'FORBIDDEN', msg = 'Access denied') {
    return new ApiError(403, code, msg);
  }
  static notFound(code = 'NOT_FOUND', msg = 'Resource not found') {
    return new ApiError(404, code, msg);
  }
  static conflict(code: string, msg: string) {
    return new ApiError(409, code, msg);
  }
  static tooMany(code = 'RATE_LIMITED', msg = 'Too many requests') {
    return new ApiError(429, code, msg);
  }
  static internal(code = 'INTERNAL_ERROR', msg = 'Something went wrong') {
    return new ApiError(500, code, msg);
  }
}
