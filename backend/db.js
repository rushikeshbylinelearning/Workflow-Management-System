const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'workflow_db',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 100,
  waitForConnections: true,
  charset: 'utf8mb4',
  timezone: '+05:30',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
};

// Create connection pool
let pool = mysql.createPool(dbConfig);
let poolClosed = false;
let poolClosing = false;

// Handle pool-level errors to prevent process crash
pool.on('error', (err) => {
  console.error('MySQL pool error:', err.message);
});

function assertPoolOpen() {
  if (poolClosed || poolClosing) {
    const err = new Error('Database pool is not available');
    err.code = 'POOL_CLOSED';
    throw err;
  }
}

// Database helper functions
const db = {
  // Execute query — uses pool.query() (text protocol) for hosted-env compatibility.
  // pool.execute() (prepared statements) can fail with "Cannot read properties of
  // undefined (reading 'length')" on shared hosting MySQL configurations.
  async query(sql, params = []) {
    assertPoolOpen();
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error) {
      if (error.message !== 'Pool is closed') {
        console.error('Database query error:', error);
      }
      throw error;
    }
  },

  // Get first row
  async queryFirst(sql, params = []) {
    try {
      const rows = await this.query(sql, params);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw error;
    }
  },

  // Insert and return full result object
  async insert(sql, params = []) {
    assertPoolOpen();
    try {
      const [result] = await pool.query(sql, params);
      return result; // Return full result object with insertId
    } catch (error) {
      if (error.message !== 'Pool is closed') {
        console.error('Database insert error:', error);
      }
      throw error;
    }
  },

  // Execute query and return full result
  async execute(sql, params = []) {
    assertPoolOpen();
    try {
      const [result] = await pool.query(sql, params);
      return result;
    } catch (error) {
      if (error.message !== 'Pool is closed') {
        console.error('Database execute error:', error);
      }
      throw error;
    }
  },

  // Test connection
  async testConnection() {
    try {
      const logger = require('./utils/logger');
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      
      const dbName = process.env.DB_NAME || 'workflow_db';
      logger.info('Database connected successfully', { database: dbName });
      console.log('✅ Database connected successfully to:', dbName);
      return true;
    } catch (error) {
      const logger = require('./utils/logger');
      logger.error('Database connection failed', error);
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  },

  // Close connections
  async close() {
    if (poolClosed || poolClosing) return;
    poolClosing = true;
    try {
      await pool.end();
      poolClosed = true;
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database:', error);
    } finally {
      poolClosing = false;
    }
  },

  isPoolAvailable() {
    return !poolClosed && !poolClosing;
  },

  // Get pool instance
  getPool() {
    return pool;
  }
};

module.exports = db;
