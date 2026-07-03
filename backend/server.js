const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
require('express-async-errors');
require('dotenv').config();

const db = require('./db');
const SSENotificationServer = require('./sseServer');
const logger = require('./utils/logger');
const { requestLogger, errorLogger, setupProcessLoggers } = require('./middleware/errorLogger');

// Setup process-level error loggers
setupProcessLoggers();

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 443 : 3001);
let isShuttingDown = false;

// Reject new work while the server is draining connections
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: 'Server is shutting down',
    });
  }
  next();
});

// Initialize SSE notification server
const notificationServer = new SSENotificationServer();
global.notificationServer = notificationServer; // Make it globally accessible

// Enhanced CORS middleware for production
app.use((req, res, next) => {
  // Build allowed origins list: hardcoded dev ports + any origin set in .env
  const envOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'https://workflow.bylinelms.com',
    'http://workflow.bylinelms.com',
    ...envOrigins,
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // NOTE: Do NOT fall back to '*' when credentials are required.
  // Browsers block responses with both Access-Control-Allow-Credentials: true
  // and Access-Control-Allow-Origin: * (causes "Failed to fetch" errors).

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // CRITICAL: Disable caching for ALL API responses
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression({
  // Skip compression for SSE streams — compressing them causes ERR_CONTENT_DECODING_FAILED
  filter: (req, res) => {
    if (req.path === '/api/notifications/stream') return false;
    return compression.filter(req, res);
  }
}));

// Request logging middleware
app.use(requestLogger);

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await db.testConnection();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'Connected' : 'Disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// SSE notification stream endpoint
app.get('/api/notifications/stream', (req, res) => {
  notificationServer.handleConnection(req, res);
});

// SSE health check
app.get('/api/notifications/health', (req, res) => {
  res.json({
    status: 'SSE Server Ready',
    timestamp: new Date().toISOString(),
    connectedClients: notificationServer ? notificationServer.getConnectedClients() : 0,
    ...notificationServer?.getConnectedUsersCount()
  });
});

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const categoryRoutes = require('./routes/categories');
const teamRoutes = require('./routes/team');
const skillRoutes = require('./routes/skills');
const taskRoutes = require('./routes/tasks');
const stageRoutes = require('./routes/stages');
const stageTemplateRoutes = require('./routes/stageTemplates');
const gradeRoutes = require('./routes/grades');
const bookRoutes = require('./routes/books');
const unitRoutes = require('./routes/units');
const lessonRoutes = require('./routes/lessons');
const allocationRoutes = require('./routes/allocations');
const performanceFlagRoutes = require('./routes/performanceFlags');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/stage-templates', stageTemplateRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/performance-flags', performanceFlagRoutes);

const searchRoutes = require('./routes/search');
app.use('/api/search', searchRoutes);

const accessRoutes = require('./routes/access');
app.use('/api/access', accessRoutes);

const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);

const apiKeyRoutes = require('./routes/apiKeys');
app.use('/api/api-keys', apiKeyRoutes);

app.use('/api/admin', require('./routes/teamsAdmin'));

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Your custom API is running!',
    version: '1.1'
  });
});

// GET students endpoint
app.get('/students', (req, res) => {
  const students = [
    {"id": 1, "name": "Aisha", "grade": "A"},
    {"id": 2, "name": "Bilal", "grade": "B"}
  ];
  
  res.json(students);
});

app.post('/student', (req, res) => {
  const { name, email } = req.body;
  
  // Validate required fields
  if (!name) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name is required'
      }
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email is required'
      }
    });
  }
  
  res.json({
    message: 'Student API is running!',
    version: '1.1',
    name: name,
    email: email,
  });
});

app.put('/student', (req, res) => {
  const { id, name, email } = req.body;
  
  // Validate required fields
  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ID is required'
      }
    });
  }
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name is required'
      }
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email is required'
      }
    });
  }
  
  res.json({
    message: 'Student updated successfully!',
    student: {
      id: parseInt(id),
      name: name,
      grade: 'A+'
    }
  });
});

app.delete('/student', (req, res) => {
  const { id } = req.body;
  
  // Validate required fields
  if (!id) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'ID is required'
      }
    });
  }  
  res.json({
    message: 'Student deleted successfully!',
  });
});

// 204 No Content endpoint
app.delete('/student/no-content', (req, res) => {
  const { name, email } = req.body;
  
  // Validate required fields
  if (!name) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name is required'
      }
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email is required'
      }
    });
  }
  
  // Return 204 No Content - successful operation but no response body
  res.status(204).send();
});


// 404 handler — only for unknown /api/* routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// SPA fallback — serve index.html for all non-API routes so client-side
// routing works correctly on page refresh or direct URL access.
const path = require('path');
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(FRONTEND_DIST));
app.use('*', (req, res) => {
  const indexPath = path.join(FRONTEND_DIST, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If dist/index.html doesn't exist (dev mode), just return a helpful message
      res.status(200).json({ message: 'API server running. Frontend served separately in development.' });
    }
  });
});

// Global error handler
app.use(errorLogger); // Log error first

app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Database connection errors
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Database Connection Error',
      message: 'Cannot connect to database. MySQL server may not be running or is not accessible.',
      code: 'DB_CONNECTION_REFUSED'
    });
  }
  
  if (error.code === 'ER_NO_DB_ERROR') {
    return res.status(500).json({
      success: false,
      error: 'Database Not Found',
      message: 'The configured database does not exist.',
      code: 'DB_NOT_FOUND'
    });
  }
  
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(500).json({
      success: false,
      error: 'Database Access Denied',
      message: 'Invalid database credentials. Check DB_USER and DB_PASSWORD.',
      code: 'DB_ACCESS_DENIED'
    });
  }
  
  if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      success: false,
      error: 'Table Not Found',
      message: 'Required database table does not exist.',
      code: 'TABLE_NOT_FOUND'
    });
  }
  
  // Database errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      message: 'This record already exists'
    });
  }
  
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid reference',
      message: 'Referenced record does not exist'
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: error.message,
      details: error.details
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication token is invalid'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'Authentication token has expired'
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message
  });
});

// Graceful shutdown — drain HTTP connections before closing the DB pool
function closeSseClients() {
  const closeMap = (clients) => {
    for (const res of clients.values()) {
      try {
        res.end();
      } catch {
        // ignore disconnect errors during shutdown
      }
    }
    clients.clear();
  };
  if (global.notificationServer) {
    closeMap(global.notificationServer.adminClients);
    closeMap(global.notificationServer.teamClients);
  }
}

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  closeSseClients();

  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }

  server.close(async () => {
    console.log('HTTP server closed');
    await db.close();
    process.exit(0);
  });

  setTimeout(async () => {
    console.error('Shutdown timed out — forcing exit');
    await db.close();
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    // LiteSpeed (lsnode) manages the socket itself and forbids calling listen().
    // Phusion Passenger (cPanel) expects the app to listen on the provided PORT.
    const isLiteSpeed = typeof process.env.LSNODE_VERSION !== 'undefined' ||
                        (server.listen && server.listen.name === 'customListen');

    logger.info('Startup Environment Check', {
      isLiteSpeed,
      hasCustomListen: !!(server.listen && server.listen.name === 'customListen'),
      nodeEnv: process.env.NODE_ENV,
      port: PORT,
      isPassenger: typeof process.env.PASSENGER_APP_ENV !== 'undefined'
    });

    if (!isLiteSpeed) {
      // In some environments (like Phusion Passenger), PORT might be a Unix socket path
      const listenArgs = isNaN(PORT) ? [PORT] : [PORT, '0.0.0.0'];
      
      server.listen(...listenArgs, () => {
        const addr = server.address();
        const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        
        logger.info('🚀 Server listening successfully', { bind, port: PORT });
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('\n🚀 Server Information:');
          console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
          console.log(`   Port: ${PORT}`);
          console.log(`   Database: ${process.env.DB_NAME || 'workflow_db'}`);
          console.log(`\n📍 Endpoints:`);
          console.log(`   Health Check: http://localhost:${PORT}/api/health`);
          console.log(`   API Base: http://localhost:${PORT}/api`);
        }
      });

      // Handle listen errors (like EADDRINUSE or EACCES)
      server.on('error', (error) => {
        logger.critical('Server Listen Error', error, { port: PORT });
        console.error('❌ Server failed to listen:', error.message);
        process.exit(1);
      });

    } else {
      logger.info('🚀 Running under LiteSpeed — socket managed by lsnode.');
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n🚀 Running under LiteSpeed — socket managed by lsnode.');
      }
    }
    
  } catch (error) {
    logger.critical('Failed to start server', error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;