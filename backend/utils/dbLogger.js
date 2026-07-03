/**
 * Database Query Logger
 * Wraps database queries to log all operations and errors
 */

const logger = require('./logger');

/**
 * Wrap database query with logging
 */
function logQuery(queryFn, queryName = 'query') {
  return async function(...args) {
    const startTime = Date.now();
    const [sql, params] = args;
    
    try {
      const result = await queryFn.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Log successful query (only in development or if slow)
      if (process.env.NODE_ENV !== 'production' || duration > 1000) {
        logger.database(sql, params, duration);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed query
      logger.database(sql, params, duration, error);
      
      // Re-throw error
      throw error;
    }
  };
}

/**
 * Create logged database wrapper
 */
function createLoggedDb(db) {
  return {
    // Wrap query method
    query: logQuery(db.query.bind(db), 'query'),
    
    // Wrap queryFirst method
    queryFirst: logQuery(db.queryFirst.bind(db), 'queryFirst'),
    
    // Wrap insert method
    insert: logQuery(db.insert.bind(db), 'insert'),
    
    // Wrap execute method
    execute: logQuery(db.execute.bind(db), 'execute'),
    
    // Pass through other methods
    testConnection: db.testConnection.bind(db),
    close: db.close.bind(db),
    getPool: db.getPool.bind(db)
  };
}

module.exports = {
  logQuery,
  createLoggedDb
};
