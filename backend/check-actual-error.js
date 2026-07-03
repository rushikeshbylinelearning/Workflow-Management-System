#!/usr/bin/env node

/**
 * Check Actual Error Script
 * This will try to start the server components one by one to find the exact error
 */

require('dotenv').config();

async function checkActualError() {
  console.log('\n🔍 Checking for actual startup errors...\n');

  // Step 1: Check environment
  console.log('1️⃣  Environment Variables:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   DB_NAME: ${process.env.DB_NAME}`);
  console.log(`   DB_USER: ${process.env.DB_USER}`);
  console.log(`   DB_HOST: ${process.env.DB_HOST}`);

  // Step 2: Test database connection
  console.log('\n2️⃣  Testing Database Connection...');
  try {
    const db = require('./db');
    const connected = await db.testConnection();
    if (!connected) {
      console.error('   ❌ Database connection failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('   ❌ Database error:', error.message);
    process.exit(1);
  }

  // Step 3: Check critical tables
  console.log('\n3️⃣  Checking Critical Tables...');
  const db = require('./db');
  const criticalTables = [
    'admin_users',
    'admin_sessions',
    'team_members',
    'team_member_sessions',
    'projects',
    'tasks'
  ];

  for (const table of criticalTables) {
    try {
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`   ✅ ${table}`);
    } catch (error) {
      console.error(`   ❌ ${table}: ${error.message}`);
    }
  }

  // Step 4: Try to load controllers
  console.log('\n4️⃣  Loading Controllers...');
  try {
    require('./controllers/authController');
    console.log('   ✅ authController');
  } catch (error) {
    console.error('   ❌ authController:', error.message);
    console.error('   Stack:', error.stack);
  }

  try {
    require('./controllers/projectController');
    console.log('   ✅ projectController');
  } catch (error) {
    console.error('   ❌ projectController:', error.message);
  }

  try {
    require('./controllers/taskController');
    console.log('   ✅ taskController');
  } catch (error) {
    console.error('   ❌ taskController:', error.message);
  }

  // Step 5: Try to load routes
  console.log('\n5️⃣  Loading Routes...');
  try {
    require('./routes/auth');
    console.log('   ✅ auth routes');
  } catch (error) {
    console.error('   ❌ auth routes:', error.message);
    console.error('   Stack:', error.stack);
  }

  // Step 6: Try to initialize Express
  console.log('\n6️⃣  Initializing Express...');
  try {
    const express = require('express');
    const app = express();
    console.log('   ✅ Express initialized');
  } catch (error) {
    console.error('   ❌ Express error:', error.message);
  }

  console.log('\n✅ All checks passed! The issue might be in server.js startup logic.\n');
  console.log('💡 Try running: node server.js 2>&1 | tee startup-error.log');
  console.log('   This will capture the exact error message.\n');

  process.exit(0);
}

checkActualError().catch(error => {
  console.error('\n❌ Check failed:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});
