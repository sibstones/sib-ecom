import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Log validation attempt for auth endpoints
      if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
        console.log('🔍 Validation check:', {
          path: req.path,
          bodyKeys: Object.keys(req.body || {}),
          hasEmail: !!req.body?.email,
          hasPassword: !!req.body?.password,
        });
      }
      
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown; query?: unknown; params?: unknown };
      if (result.body !== undefined) req.body = result.body;
      if (result.query !== undefined) req.query = result.query as typeof req.query;
      if (result.params !== undefined) req.params = result.params as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        
        // Log validation errors for auth endpoints
        if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
          console.error('❌ Validation failed:', {
            path: req.path,
            errors: error.errors,
            message: errorMessage,
          });
        }
        
        res.status(400).json({
          error: 'Validation error',
          message: errorMessage,
          details: error.errors,
        });
        return;
      } else {
        next(error);
      }
    }
  };
};
