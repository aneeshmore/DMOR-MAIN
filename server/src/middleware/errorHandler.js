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
    ...(err.cause && {
      causeMessage: err.cause.message,
      causeCode: err.cause.code,
      causeDetail: err.cause.detail,
      causeStack: err.cause.stack,
    }),
  });

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
        code,
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
