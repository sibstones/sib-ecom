import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error | unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  const error = err instanceof Error ? err : new Error('Unknown error');
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  const message = error.message || 'Internal server error';

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};
