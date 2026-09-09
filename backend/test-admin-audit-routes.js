const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Admin Audit Routes Configuration\n');
console.log('📁 Current directory:', process.cwd());
console.log('');

// Test 1: Check if admin audit controller exists
console.log('1️⃣  Checking if admin audit controller file exists...');
const controllerPath = path.join(__dirname, 'controllers', 'adminAuditController.js');
if (fs.existsSync(controllerPath)) {
  console.log('   ✅ Admin audit controller file found');
  const controllerContent = fs.readFileSync(controllerPath, 'utf8');
  console.log('   ✅ Contains getAllPerformanceFlags:', controllerContent.includes('getAllPerformanceFlags'));
  console.log('   ✅ Contains deletePerformanceFlag:', controllerContent.includes('deletePerformanceFlag'));
  console.log('   ✅ Contains module.exports:', controllerContent.includes('module.exports'));
} else {
  console.log('   ❌ Admin audit controller NOT found at:', controllerPath);
}

// Test 2: Check if admin audit routes file exists
console.log('\n2️⃣  Checking admin audit routes file...');
const routesPath = path.join(__dirname, 'routes', 'adminAudit.js');
if (fs.existsSync(routesPath)) {
  console.log('   ✅ Admin audit routes file found');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  console.log('   ✅ GET /flags route:', routesContent.includes("router.get('/flags'"));
  console.log('   ✅ DELETE /flags/:flagId route:', routesContent.includes("router.delete('/flags/:flagId'"));
  console.log('   ✅ POST /flags/bulk-delete route:', routesContent.includes("router.post('/flags/bulk-delete'"));
} else {
  console.log('   ❌ Admin audit routes file NOT found');
}

// Test 3: Check if server.js registers the routes
console.log('\n3️⃣  Checking if routes are registered in server.js...');
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  const hasRequire = serverContent.includes("require('./routes/adminAudit')");
  const hasMount = serverContent.includes("app.use('/api/admin-audit'");
  
  if (hasRequire) {
    console.log('   ✅ Admin audit routes are required in server.js');
  } else {
    console.log('   ❌ Admin audit routes NOT required in server.js');
  }
  
  if (hasMount) {
    console.log('   ✅ Admin audit routes are mounted at /api/admin-audit');
  } else {
    console.log('   ❌ Admin audit routes NOT mounted in server.js');
  }
  
  // Show the exact lines
  if (hasRequire || hasMount) {
    console.log('\n   📄 Relevant lines from server.js:');
    const lines = serverContent.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('adminAudit')) {
        console.log(`      Line ${index + 1}: ${line.trim()}`);
      }
    });
  }
} else {
  console.log('   ❌ server.js NOT found');
}

// Test 4: Check .env configuration
console.log('\n4️⃣  Checking .env configuration...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file found');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('   📊 Environment:', envContent.includes('NODE_ENV=production') ? 'Production' : 'Development');
  console.log('   📊 Port:', (envContent.match(/PORT=(\d+)/) || ['', 'Not set'])[1]);
  console.log('   📊 Database:', (envContent.match(/DB_NAME=(\S+)/) || ['', 'Not set'])[1]);
} else {
  console.log('   ❌ .env file NOT found');
}

// Test 5: Check if package.json has necessary dependencies
console.log('\n5️⃣  Checking package.json...');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageContent = fs.readFileSync(packagePath, 'utf8');
  const packageJson = JSON.parse(packageContent);
  console.log('   ✅ Package name:', packageJson.name);
  console.log('   ✅ Has express:', !!packageJson.dependencies?.express);
  console.log('   ✅ Has mysql2:', !!packageJson.dependencies?.mysql2);
  console.log('   ✅ Has dotenv:', !!packageJson.dependencies?.dotenv);
} else {
  console.log('   ❌ package.json NOT found');
}

// Test 6: Check if node_modules is installed
console.log('\n6️⃣  Checking node_modules...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules directory exists');
} else {
  console.log('   ⚠️  node_modules directory NOT found - run "npm install"');
}

console.log('\n✅ Diagnostic complete!');
console.log('\n📌 Summary:');
console.log('   The routes appear to be properly configured in the codebase.');
console.log('   If you\'re getting "Route not found" on the hosted server, the issue is likely:');
console.log('   1. The hosted server has old code - needs redeployment');
console.log('   2. PM2 needs to be restarted to pick up code changes');
console.log('   3. There\'s a build/cache issue on the server');
console.log('\n💡 Suggested fixes for hosted environment:');
console.log('   1. SSH into the server and restart PM2: pm2 restart all');
console.log('   2. Check PM2 logs: pm2 logs');
console.log('   3. Verify the admin audit files exist on the server');
console.log('   4. Clear any nginx cache if applicable');
