import { ZodError } from 'zod';
import logger from '../config/logger.js';
import { AppError } from '../utils/AppError.js';

export const errorHandler = (err, req, res, next) => {
  const error = { ...err };
  error.message = err.message;

  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    statusCode: err.statusCode,
  });

  // A raw ZodError (e.g. schema.parse(req.body) in a controller, thrown without being wrapped
  // in AppError) has no statusCode of its own, so it was falling through to the default 500
  // branch below — a legitimate validation message like "Reason is required for holding an
  // order" was being discarded and replaced with a generic "Server error" by the frontend's
  // 500 handler. Every Zod-validated endpoint in the app was affected, not just one flow.
  // Converting it to a proper 400 here restores the real message without touching any
  // individual route, controller, or validation schema.
  if (err instanceof ZodError) {
    const message = err.errors.map(e => e.message).join('; ');
    return res.status(400).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    });
  }

  // If it's already an AppError, use its statusCode and message
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      // Include structured data if present (e.g., for stock validation errors)
      ...(err.data && { data: err.data }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    });
  }

  // Handle database constraint violations (23xxx codes)
  // Drizzle ORM often wraps the original error in `cause`
  const code = err.code || (err.cause && err.cause.code);
  
  if (code && String(code).startsWith('23')) {
    return res.status(400).json({
      success: false,
      message: 'Database constraint violation',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        code: code,
        detail: err.detail || (err.cause && err.cause.detail),
      }),
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
};
