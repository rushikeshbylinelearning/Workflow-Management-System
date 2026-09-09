/**
 * Check Hosted Server Routes
 * 
 * This script tests if the admin audit routes are accessible on the hosted server.
 * Run this from your local machine to diagnose remote server issues.
 */

const https = require('https');
const http = require('http');

const SERVER_URL = 'https://workflow.bylinelms.com';
// If you need to test with a specific token, add it here:
const AUTH_TOKEN = process.env.ADMIN_TOKEN || '';

console.log('🔍 Checking Hosted Server Routes\n');
console.log(`📍 Server: ${SERVER_URL}\n`);

// Test endpoints
const endpoints = [
  { path: '/api/health', method: 'GET', requiresAuth: false },
  { path: '/api/admin-audit/flags', method: 'GET', requiresAuth: true },
  { path: '/api/performance-flags/team-member/1', method: 'GET', requiresAuth: false },
  { path: '/api/dashboard/performance-flags', method: 'GET', requiresAuth: false },
];

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, SERVER_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        'Accept': 'application/json',
      },
      // Allow self-signed certificates for testing
      rejectUnauthorized: false,
    };
    
    // Add auth token if endpoint requires it and token is available
    if (endpoint.requiresAuth && AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          endpoint: endpoint.path,
          status: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          message: res.statusMessage,
          data: data.substring(0, 200), // First 200 chars of response
          requiresAuth: endpoint.requiresAuth,
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        endpoint: endpoint.path,
        status: 0,
        success: false,
        error: error.message,
        requiresAuth: endpoint.requiresAuth,
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        endpoint: endpoint.path,
        status: 0,
        success: false,
        error: 'Request timeout',
        requiresAuth: endpoint.requiresAuth,
      });
    });
    
    req.end();
  });
}

// Test all endpoints
async function runTests() {
  console.log('Testing endpoints...\n');
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    const icon = result.success ? '✅' : '❌';
    const authNote = result.requiresAuth && !AUTH_TOKEN ? ' (no auth token provided)' : '';
    
    console.log(`${icon} ${endpoint.method} ${result.endpoint}`);
    console.log(`   Status: ${result.status} ${result.message || ''}${authNote}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (result.data) {
      try {
        const json = JSON.parse(result.data);
        if (json.message && json.message.includes('not found')) {
          console.log(`   ⚠️  Route not found - endpoint may not be deployed`);
        } else if (json.success === false) {
          console.log(`   Response: ${json.error || json.message || 'Error'}`);
        } else {
          console.log(`   Response: OK`);
        }
      } catch {
        console.log(`   Response: ${result.data.substring(0, 100)}...`);
      }
    }
    
    console.log('');
  }
  
  console.log('📊 Summary:');
  console.log('─'.repeat(50));
  console.log('');
  console.log('If you see "Route not found" for /api/admin-audit/flags:');
  console.log('');
  console.log('1. The admin audit routes are NOT deployed to the server');
  console.log('2. You need to upload:');
  console.log('   - backend/routes/adminAudit.js');
  console.log('   - backend/controllers/adminAuditController.js');
  console.log('3. Then restart PM2 on the server');
  console.log('');
  console.log('If you see 401 Unauthorized:');
  console.log('');
  console.log('1. The route exists but requires authentication');
  console.log('2. Set ADMIN_TOKEN environment variable and run again:');
  console.log('   ADMIN_TOKEN=your_token_here node check-hosted-routes.js');
  console.log('');
  console.log('If you see 500 Internal Server Error:');
  console.log('');
  console.log('1. The route exists but there\'s a server error');
  console.log('2. Check PM2 logs on the server: pm2 logs --err');
  console.log('3. Check database connection');
  console.log('');
  
  if (!AUTH_TOKEN) {
    console.log('💡 Tip: To test authenticated endpoints, get your admin token');
    console.log('   from browser DevTools → Application → Cookies → token');
    console.log('   Then run: ADMIN_TOKEN=your_token node check-hosted-routes.js');
    console.log('');
  }
}

runTests().catch(console.error);
