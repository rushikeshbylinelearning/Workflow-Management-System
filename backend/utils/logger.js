/**
 * Comprehensive Error Logger
 * Logs all errors to file with detailed information
 */

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const ERROR_LOG_FILE = path.join(logsDir, 'error.log');
const ALL_LOG_FILE = path.join(logsDir, 'app.log');
const ACCESS_LOG_FILE = path.join(logsDir, 'access.log');
const DATABASE_LOG_FILE = path.join(logsDir, 'database.log');

/**
 * Format log entry with timestamp and details
 */
function formatLogEntry(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...details
  };
  
  return JSON.stringify(logEntry, null, 2) + '\n' + '-'.repeat(80) + '\n';
}

/**
 * Write to log file
 */
function writeToFile(filePath, content) {
  try {
    fs.appendFileSync(filePath, content, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

/**
 * Logger class
 */
class Logger {
  /**
   * Log error with full details
   */
  error(message, error = null, context = {}) {
    const details = {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage,
        sql: error.sql
      } : null,
      context,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    const logEntry = formatLogEntry('ERROR', message, details);
    
    // Write to error log
    writeToFile(ERROR_LOG_FILE, logEntry);
    
    // Also write to main log
    writeToFile(ALL_LOG_FILE, logEntry);
    
    // Console output
    console.error(`[ERROR] ${message}`, error);
  }

  /**
   * Log warning
   */
  warn(message, context = {}) {
    const details = {
      context,
      pid: process.pid
    };

    const logEntry = formatLogEntry('WARN', message, details);
    writeToFile(ALL_LOG_FILE, logEntry);
    console.warn(`[WARN] ${message}`);
  }

  /**
   * Log info
   */
  info(message, context = {}) {
    const details = {
      context,
      pid: process.pid
    };

    const logEntry = formatLogEntry('INFO', message, details);
    writeToFile(ALL_LOG_FILE, logEntry);
    console.log(`[INFO] ${message}`);
  }

  /**
   * Log debug (only in development)
   */
  debug(message, context = {}) {
    if (process.env.NODE_ENV !== 'production') {
      const details = {
        context,
        pid: process.pid
      };

      const logEntry = formatLogEntry('DEBUG', message, details);
      writeToFile(ALL_LOG_FILE, logEntry);
      console.debug(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log HTTP request
   */
  access(req, res, responseTime) {
    const details = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      userType: req.user?.type
    };

    const logEntry = formatLogEntry('ACCESS', `${req.method} ${req.originalUrl}`, details);
    writeToFile(ACCESS_LOG_FILE, logEntry);
  }

  /**
   * Log database query
   */
  database(query, params, duration, error = null) {
    const details = {
      query: query.substring(0, 500), // Limit query length
      params: params ? JSON.stringify(params).substring(0, 200) : null,
      duration: `${duration}ms`,
      error: error ? {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      } : null
    };

    const level = error ? 'ERROR' : 'INFO';
    const logEntry = formatLogEntry(level, 'Database Query', details);
    writeToFile(DATABASE_LOG_FILE, logEntry);
    
    if (error) {
      writeToFile(ERROR_LOG_FILE, logEntry);
    }
  }

  /**
   * Log authentication attempt
   */
  auth(success, email, reason = null, context = {}) {
    const details = {
      success,
      email,
      reason,
      ...context,
      ip: context.ip,
      userAgent: context.userAgent
    };

    const level = success ? 'INFO' : 'WARN';
    const message = success ? 'Authentication Success' : 'Authentication Failed';
    const logEntry = formatLogEntry(level, message, details);
    
    writeToFile(ALL_LOG_FILE, logEntry);
    
    if (!success) {
      writeToFile(ERROR_LOG_FILE, logEntry);
    }
  }

  /**
   * Log critical system error
   */
  critical(message, error = null, context = {}) {
    const details = {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null,
      context,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV
    };

    const logEntry = formatLogEntry('CRITICAL', message, details);
    
    // Write to all logs
    writeToFile(ERROR_LOG_FILE, logEntry);
    writeToFile(ALL_LOG_FILE, logEntry);
    
    console.error(`[CRITICAL] ${message}`, error);
  }

  /**
   * Log startup information
   */
  startup(info) {
    const details = {
      ...info,
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    };

    const logEntry = formatLogEntry('STARTUP', 'Application Started', details);
    writeToFile(ALL_LOG_FILE, logEntry);
    console.log('[STARTUP] Application Started');
  }

  /**
   * Log shutdown information
   */
  shutdown(reason) {
    const details = {
      reason,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    const logEntry = formatLogEntry('SHUTDOWN', 'Application Shutting Down', details);
    writeToFile(ALL_LOG_FILE, logEntry);
    console.log('[SHUTDOWN] Application Shutting Down');
  }

  /**
   * Get log file paths
   */
  getLogFiles() {
    return {
      error: ERROR_LOG_FILE,
      all: ALL_LOG_FILE,
      access: ACCESS_LOG_FILE,
      database: DATABASE_LOG_FILE
    };
  }

  /**
   * Clear log files (use with caution)
   */
  clearLogs() {
    try {
      fs.writeFileSync(ERROR_LOG_FILE, '');
      fs.writeFileSync(ALL_LOG_FILE, '');
      fs.writeFileSync(ACCESS_LOG_FILE, '');
      fs.writeFileSync(DATABASE_LOG_FILE, '');
      console.log('All log files cleared');
    } catch (err) {
      console.error('Failed to clear log files:', err);
    }
  }

  /**
   * Rotate log files (create backup and start fresh)
   */
  rotateLogs() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      // Backup existing logs
      if (fs.existsSync(ERROR_LOG_FILE)) {
        fs.renameSync(ERROR_LOG_FILE, `${ERROR_LOG_FILE}.${timestamp}`);
      }
      if (fs.existsSync(ALL_LOG_FILE)) {
        fs.renameSync(ALL_LOG_FILE, `${ALL_LOG_FILE}.${timestamp}`);
      }
      if (fs.existsSync(ACCESS_LOG_FILE)) {
        fs.renameSync(ACCESS_LOG_FILE, `${ACCESS_LOG_FILE}.${timestamp}`);
      }
      if (fs.existsSync(DATABASE_LOG_FILE)) {
        fs.renameSync(DATABASE_LOG_FILE, `${DATABASE_LOG_FILE}.${timestamp}`);
      }
      
      console.log('Log files rotated successfully');
    } catch (err) {
      console.error('Failed to rotate log files:', err);
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger instance
module.exports = logger;
