#!/usr/bin/env node

/**
 * Comprehensive 503 Error Diagnostic Tool
 * Identifies why the backend is returning 503 Service Unavailable errors
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
require('dotenv').config();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ERROR: ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ SUCCESS: ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  WARNING: ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  INFO: ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`),
  detail: (msg) => console.log(`   ${msg}`),
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const diagnosticLogFile = path.join(logsDir, `diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const diagnosticStream = fs.createWriteStream(diagnosticLogFile, { flags: 'a' });

const writeLog = (msg) => {
  diagnosticStream.write(`${new Date().toISOString()} - ${msg}\n`);
};

// ============================================================================
// 1. ENVIRONMENT CONFIGURATION CHECK
// ============================================================================
async function checkEnvironment() {
  log.section('1. ENVIRONMENT CONFIGURATION CHECK');

  const checks = {
    'NODE_ENV': process.env.NODE_ENV,
    'PORT': process.env.PORT,
    'DB_HOST': process.env.DB_HOST,
    'DB_PORT': process.env.DB_PORT,
    'DB_NAME': process.env.DB_NAME,
    'DB_USER': process.env.DB_USER,
    'DB_PASSWORD': process.env.DB_PASSWORD ? '***HIDDEN***' : 'NOT SET',
    'JWT_SECRET': process.env.JWT_SECRET ? '***HIDDEN***' : 'NOT SET',
    'CORS_ORIGIN': process.env.CORS_ORIGIN,
  };

  let hasErrors = false;

  for (const [key, value] of Object.entries(checks)) {
    if (!value) {
      log.error(`${key} is not set`);
      writeLog(`ERROR: ${key} is not set`);
      hasErrors = true;
    } else {
      log.success(`${key} = ${value}`);
      writeLog(`OK: ${key} = ${value}`);
    }
  }

  if (!hasErrors) {
    log.success('All environment variables are configured');
  }

  return !hasErrors;
}

// ============================================================================
// 2. DATABASE CONNECTION CHECK
// ============================================================================
async function checkDatabaseConnection() {
  log.section('2. DATABASE CONNECTION CHECK');

  try {
    const mysql = require('mysql2/promise');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0,
    });

    log.success(`Connected to database: ${process.env.DB_NAME}`);
    writeLog(`OK: Connected to database ${process.env.DB_NAME}`);

    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    log.success('Database query test successful');
    writeLog('OK: Database query test successful');

    // Check if critical tables exist
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
      [process.env.DB_NAME]
    );

    log.info(`Found ${tables.length} tables in database`);
    writeLog(`OK: Found ${tables.length} tables in database`);

    const requiredTables = ['admin_users', 'team_members', 'projects', 'tasks'];
    const missingTables = [];

    for (const table of requiredTables) {
      const exists = tables.some(t => t.TABLE_NAME === table);
      if (exists) {
        log.success(`Table exists: ${table}`);
        writeLog(`OK: Table exists: ${table}`);
      } else {
        log.error(`Table missing: ${table}`);
        writeLog(`ERROR: Table missing: ${table}`);
        missingTables.push(table);
      }
    }

    await connection.end();

    return missingTables.length === 0;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    writeLog(`ERROR: Database connection failed: ${error.message}`);
    writeLog(`Stack: ${error.stack}`);

    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      log.detail('Connection was lost. Check if MySQL server is running.');
      writeLog('DETAIL: Connection was lost. Check if MySQL server is running.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      log.detail('Access denied. Check DB_USER and DB_PASSWORD.');
      writeLog('DETAIL: Access denied. Check DB_USER and DB_PASSWORD.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      log.detail('Database does not exist. Check DB_NAME.');
      writeLog('DETAIL: Database does not exist. Check DB_NAME.');
    } else if (error.code === 'ECONNREFUSED') {
      log.detail(`Cannot connect to ${process.env.DB_HOST}:${process.env.DB_PORT}. Check DB_HOST and DB_PORT.`);
      writeLog(`DETAIL: Cannot connect to ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    }

    return false;
  }
}

// ============================================================================
// 3. PORT AVAILABILITY CHECK
// ============================================================================
async function checkPortAvailability() {
  log.section('3. PORT AVAILABILITY CHECK');

  const port = process.env.PORT || 3005;

  return new Promise((resolve) => {
    const server = http.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log.warning(`Port ${port} is already in use`);
        writeLog(`WARNING: Port ${port} is already in use`);
        log.detail('Another process is using this port. You may need to:');
        log.detail('  1. Kill the existing process');
        log.detail('  2. Use a different port');
        log.detail('  3. Check if the server is already running');
        resolve(false);
      } else if (err.code === 'EACCES') {
        log.error(`Permission denied to use port ${port}`);
        writeLog(`ERROR: Permission denied to use port ${port}`);
        log.detail('You may need to use a port > 1024 or run with elevated privileges');
        resolve(false);
      } else {
        log.error(`Port check failed: ${err.message}`);
        writeLog(`ERROR: Port check failed: ${err.message}`);
        resolve(false);
      }
    });

    server.once('listening', () => {
      log.success(`Port ${port} is available`);
      writeLog(`OK: Port ${port} is available`);
      server.close();
      resolve(true);
    });

    server.listen(port, '0.0.0.0');
  });
}

// ============================================================================
// 4. FILE SYSTEM CHECK
// ============================================================================
async function checkFileSystem() {
  log.section('4. FILE SYSTEM CHECK');

  const requiredFiles = [
    'server.js',
    'db.js',
    'package.json',
    'middleware/auth.js',
    'routes/auth.js',
  ];

  let allExist = true;

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      log.success(`File exists: ${file}`);
      writeLog(`OK: File exists: ${file}`);
    } else {
      log.error(`File missing: ${file}`);
      writeLog(`ERROR: File missing: ${file}`);
      allExist = false;
    }
  }

  // Check logs directory
  if (fs.existsSync(logsDir)) {
    log.success(`Logs directory exists: ${logsDir}`);
    writeLog(`OK: Logs directory exists: ${logsDir}`);
  } else {
    log.warning(`Logs directory does not exist: ${logsDir}`);
    writeLog(`WARNING: Logs directory does not exist: ${logsDir}`);
  }

  return allExist;
}

// ============================================================================
// 5. MIDDLEWARE CHECK
// ============================================================================
async function checkMiddleware() {
  log.section('5. MIDDLEWARE CHECK');

  try {
    const authMiddleware = require('./middleware/auth');

    const requiredFunctions = [
      'requireAdminAuth',
      'requireTeamAuth',
      'requireAuth',
      'optionalAuth',
      'requireAdminOrPMAuth',
      'requireApiKey',
      'requireApiKeyOrAuth',
    ];

    let allExist = true;

    for (const func of requiredFunctions) {
      if (typeof authMiddleware[func] === 'function') {
        log.success(`Middleware function exists: ${func}`);
        writeLog(`OK: Middleware function exists: ${func}`);
      } else {
        log.error(`Middleware function missing: ${func}`);
        writeLog(`ERROR: Middleware function missing: ${func}`);
        allExist = false;
      }
    }

    return allExist;
  } catch (error) {
    log.error(`Failed to load middleware: ${error.message}`);
    writeLog(`ERROR: Failed to load middleware: ${error.message}`);
    return false;
  }
}

// ============================================================================
// 6. ROUTES CHECK
// ============================================================================
async function checkRoutes() {
  log.section('6. ROUTES CHECK');

  const requiredRoutes = [
    'routes/auth.js',
    'routes/projects.js',
    'routes/team.js',
    'routes/tasks.js',
  ];

  let allExist = true;

  for (const route of requiredRoutes) {
    const routePath = path.join(__dirname, route);
    if (fs.existsSync(routePath)) {
      log.success(`Route file exists: ${route}`);
      writeLog(`OK: Route file exists: ${route}`);
    } else {
      log.error(`Route file missing: ${route}`);
      writeLog(`ERROR: Route file missing: ${route}`);
      allExist = false;
    }
  }

  return allExist;
}

// ============================================================================
// 7. DEPENDENCIES CHECK
// ============================================================================
async function checkDependencies() {
  log.section('7. DEPENDENCIES CHECK');

  const requiredPackages = [
    'express',
    'mysql2',
    'jsonwebtoken',
    'dotenv',
    'cors',
    'morgan',
  ];

  let allExist = true;

  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
      log.success(`Package installed: ${pkg}`);
      writeLog(`OK: Package installed: ${pkg}`);
    } catch (error) {
      log.error(`Package missing: ${pkg}`);
      writeLog(`ERROR: Package missing: ${pkg}`);
      allExist = false;
    }
  }

  if (!allExist) {
    log.detail('Run: npm install');
    writeLog('DETAIL: Run npm install to install missing packages');
  }

  return allExist;
}

// ============================================================================
// 8. ERROR LOG ANALYSIS
// ============================================================================
async function analyzeErrorLogs() {
  log.section('8. ERROR LOG ANALYSIS');

  const errorLogPath = path.join(logsDir, 'error.log');

  if (!fs.existsSync(errorLogPath)) {
    log.warning('No error log file found');
    writeLog('WARNING: No error log file found');
    return;
  }

  try {
    const content = fs.readFileSync(errorLogPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    log.info(`Error log contains ${lines.length} entries`);
    writeLog(`INFO: Error log contains ${lines.length} entries`);

    // Show last 10 errors
    log.detail('Last 10 errors:');
    const lastErrors = lines.slice(-10);

    for (const error of lastErrors) {
      try {
        const parsed = JSON.parse(error);
        log.detail(`[${parsed.timestamp}] ${parsed.message}`);
        writeLog(`DETAIL: [${parsed.timestamp}] ${parsed.message}`);

        if (parsed.error && parsed.error.message) {
          log.detail(`  → ${parsed.error.message}`);
          writeLog(`DETAIL:   → ${parsed.error.message}`);
        }
      } catch (e) {
        log.detail(error.substring(0, 100));
        writeLog(`DETAIL: ${error.substring(0, 100)}`);
      }
    }
  } catch (error) {
    log.error(`Failed to read error log: ${error.message}`);
    writeLog(`ERROR: Failed to read error log: ${error.message}`);
  }
}

// ============================================================================
// 9. NETWORK/CONNECTIVITY CHECK
// ============================================================================
async function checkNetworkConnectivity() {
  log.section('9. NETWORK/CONNECTIVITY CHECK');

  // Check if we can reach the database host
  const dns = require('dns').promises;

  try {
    const address = await dns.resolve4(process.env.DB_HOST);
    log.success(`DNS resolution successful for ${process.env.DB_HOST}: ${address[0]}`);
    writeLog(`OK: DNS resolution successful for ${process.env.DB_HOST}: ${address[0]}`);
  } catch (error) {
    log.error(`DNS resolution failed for ${process.env.DB_HOST}: ${error.message}`);
    writeLog(`ERROR: DNS resolution failed for ${process.env.DB_HOST}: ${error.message}`);
  }
}

// ============================================================================
// 10. GENERATE SUMMARY REPORT
// ============================================================================
async function generateSummaryReport(results) {
  log.section('DIAGNOSTIC SUMMARY REPORT');

  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    environment: results.environment,
    database: results.database,
    port: results.port,
    filesystem: results.filesystem,
    middleware: results.middleware,
    routes: results.routes,
    dependencies: results.dependencies,
    network: results.network,
  };

  const passed = Object.values(report).filter(v => v === true).length;
  const total = Object.keys(report).length - 1; // Exclude timestamp

  log.info(`Passed: ${passed}/${total} checks`);
  writeLog(`INFO: Passed ${passed}/${total} checks`);

  if (passed === total) {
    log.success('All diagnostic checks passed!');
    writeLog('SUCCESS: All diagnostic checks passed!');
    log.detail('Your backend should be working correctly.');
    log.detail('If you are still getting 503 errors, check:');
    log.detail('  1. Is the server actually running? (npm start)');
    log.detail('  2. Is the frontend correctly proxying to the backend?');
    log.detail('  3. Check the error logs for specific error messages');
  } else {
    log.error('Some diagnostic checks failed!');
    writeLog('ERROR: Some diagnostic checks failed!');
    log.detail('Please fix the issues listed above.');
  }

  // Write report to file
  const reportPath = path.join(logsDir, `diagnostic-report-${timestamp.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.info(`Full report saved to: ${reportPath}`);
  writeLog(`INFO: Full report saved to: ${reportPath}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  console.clear();
  log.section('BACKEND 503 ERROR DIAGNOSTIC TOOL');
  log.info(`Diagnostic started at ${new Date().toISOString()}`);
  log.info(`Logs will be saved to: ${diagnosticLogFile}`);
  writeLog('='.repeat(80));
  writeLog('BACKEND 503 ERROR DIAGNOSTIC TOOL');
  writeLog(`Started at ${new Date().toISOString()}`);
  writeLog('='.repeat(80));

  const results = {
    environment: await checkEnvironment(),
    database: await checkDatabaseConnection(),
    port: await checkPortAvailability(),
    filesystem: await checkFileSystem(),
    middleware: await checkMiddleware(),
    routes: await checkRoutes(),
    dependencies: await checkDependencies(),
  };

  await checkNetworkConnectivity();
  await analyzeErrorLogs();
  await generateSummaryReport(results);

  log.section('NEXT STEPS');
  log.info('1. Review the diagnostic report above');
  log.info('2. Fix any failed checks');
  log.info('3. Start the server: npm start');
  log.info('4. Test the health endpoint: curl http://localhost:3005/api/health');
  log.info(`5. Check logs: tail -f ${path.join(logsDir, 'error.log')}`);

  writeLog('='.repeat(80));
  writeLog(`Diagnostic completed at ${new Date().toISOString()}`);
  writeLog('='.repeat(80));

  diagnosticStream.end();

  console.log(`\n${colors.cyan}📋 Full diagnostic log saved to:${colors.reset}`);
  console.log(`   ${diagnosticLogFile}\n`);
}

// Run the diagnostic
main().catch(error => {
  log.error(`Diagnostic failed: ${error.message}`);
  writeLog(`FATAL ERROR: ${error.message}`);
  writeLog(`Stack: ${error.stack}`);
  process.exit(1);
});
