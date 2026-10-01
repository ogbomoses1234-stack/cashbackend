import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

/**
 * Pass a Zod schema shaped like:
 *   z.object({
 *     body: z.object({...}).optional(),
 *     query: z.object({...}).optional(),
 *     params: z.object({...}).optional(),
 *   })
 */
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.validatedQuery = parsed.query as Record<string, unknown>;
      if (parsed.params) req.validatedParams = parsed.params as Record<string, unknown>;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          ApiError.badRequest('VALIDATION_ERROR', 'Invalid input', err.flatten().fieldErrors)
        );
      }
      next(err);
    }
  };
