#!/usr/bin/env node

/**
 * Startup Diagnostic Script
 * Run this before starting the server to check if everything is configured correctly
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function diagnose() {
  console.log('\n🔍 Running Startup Diagnostics...\n');
  
  let hasErrors = false;

  // 1. Check environment variables
  console.log('1️⃣  Checking Environment Variables...');
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`   ❌ Missing: ${envVar}`);
      hasErrors = true;
    } else {
      console.log(`   ✅ ${envVar}: ${envVar.includes('PASSWORD') || envVar.includes('SECRET') ? '***' : process.env[envVar]}`);
    }
  }

  // 2. Test database connection
  console.log('\n2️⃣  Testing Database Connection...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('   ✅ Database connection successful');
  } catch (error) {
    console.error('   ❌ Database connection failed:', error.message);
    hasErrors = true;
    
    // Try to provide helpful error messages
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   💡 Check your DB_USER and DB_PASSWORD');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   💡 Database does not exist. Create it first:');
      console.error(`      CREATE DATABASE ${process.env.DB_NAME};`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   💡 MySQL server is not running or wrong host/port');
    }
    
    process.exit(1);
  }

  // 3. Check if required tables exist
  console.log('\n3️⃣  Checking Database Tables...');
  const requiredTables = [
    'admin_users',
    'admin_sessions',
    'team_members',
    'team_member_sessions',
    'projects',
    'categories',
    'skills',
    'tasks',
    'stages'
  ];

  for (const table of requiredTables) {
    try {
      const [rows] = await connection.execute(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [process.env.DB_NAME, table]
      );
      
      if (rows[0].count > 0) {
        console.log(`   ✅ Table exists: ${table}`);
      } else {
        console.error(`   ❌ Table missing: ${table}`);
        hasErrors = true;
      }
    } catch (error) {
      console.error(`   ❌ Error checking table ${table}:`, error.message);
      hasErrors = true;
    }
  }

  // 4. Check if admin user exists
  console.log('\n4️⃣  Checking Admin User...');
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM admin_users');
    if (rows[0].count > 0) {
      console.log(`   ✅ Admin users found: ${rows[0].count}`);
    } else {
      console.warn('   ⚠️  No admin users found. You may need to create one.');
    }
  } catch (error) {
    console.error('   ❌ Error checking admin users:', error.message);
    hasErrors = true;
  }

  // Close connection
  if (connection) {
    await connection.end();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.error('❌ DIAGNOSTICS FAILED - Please fix the errors above before starting the server\n');
    console.log('📝 Common fixes:');
    console.log('   1. Run migrations: node migrate.js');
    console.log('   2. Check .env file has correct database credentials');
    console.log('   3. Ensure MySQL server is running');
    console.log('   4. Create database if it doesn\'t exist\n');
    process.exit(1);
  } else {
    console.log('✅ ALL CHECKS PASSED - Server is ready to start!\n');
    console.log('🚀 Start the server with: node server.js\n');
    process.exit(0);
  }
}

// Run diagnostics
diagnose().catch(error => {
  console.error('\n❌ Diagnostic script failed:', error);
  process.exit(1);
});
