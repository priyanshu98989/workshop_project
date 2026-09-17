const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

exports.notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

exports.errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier format.';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed.';
    details = Object.values(err.errors || {}).map((e) => e.message);
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Resource already exists.';
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err);
  }

  const payload = { error: message };
  if (details) payload.details = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};