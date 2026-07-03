/**
 * Error Logging Middleware
 * Automatically logs all errors that occur in the application
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs all incoming requests
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.access(req, res, responseTime);
  });
  
  next();
}

/**
 * Error logging middleware
 * Catches and logs all errors
 */
function errorLogger(err, req, res, next) {
  // Log the error with full context
  logger.error('Request Error', err, {
    method: req.method,
    url: req.originalUrl || req.url,
    params: req.params,
    query: req.query,
    body: req.body ? JSON.stringify(req.body).substring(0, 500) : null,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    userType: req.user?.type,
    headers: {
      authorization: req.headers.authorization ? 'Bearer ***' : undefined,
      'content-type': req.headers['content-type'],
      origin: req.headers.origin
    }
  });
  
  // Pass to next error handler
  next(err);
}

/**
 * Unhandled rejection logger
 */
function setupUnhandledRejectionLogger() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.critical('Unhandled Promise Rejection', reason, {
      promise: promise.toString()
    });
  });
}

/**
 * Uncaught exception logger
 */
function setupUncaughtExceptionLogger() {
  process.on('uncaughtException', (error) => {
    logger.critical('Uncaught Exception', error);
    
    // Give time to write logs before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

/**
 * Process warning logger
 */
function setupWarningLogger() {
  process.on('warning', (warning) => {
    logger.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
}

/**
 * Setup all process-level loggers
 */
function setupProcessLoggers() {
  setupUnhandledRejectionLogger();
  setupUncaughtExceptionLogger();
  setupWarningLogger();
  
  // Log startup
  logger.startup({
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    database: process.env.DB_NAME
  });
  
  // Log shutdown on SIGTERM
  process.on('SIGTERM', () => {
    logger.shutdown('SIGTERM received');
  });
  
  // Log shutdown on SIGINT
  process.on('SIGINT', () => {
    logger.shutdown('SIGINT received');
  });
}

module.exports = {
  requestLogger,
  errorLogger,
  setupProcessLoggers
};
