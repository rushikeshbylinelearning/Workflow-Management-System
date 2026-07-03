#!/usr/bin/env node
/**
 * Quick database connection test
 * Upload this to your hosted server and run: node test-db-connection.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  console.log('Configuration:');
  console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  Port: ${process.env.DB_PORT || 3306}`);
  console.log(`  Database: ${process.env.DB_NAME || 'workflow_db'}`);
  console.log(`  User: ${process.env.DB_USER || 'root'}`);
  console.log(`  Password: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : '(empty)'}\n`);

  try {
    console.log('Attempting to connect...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'workflow_db'
    });
    
    console.log('✅ Connection successful!\n');
    
    // Test queries
    console.log('Running test queries...');
    
    const [projects] = await connection.execute('SELECT COUNT(*) as count FROM projects');
    console.log(`✅ Projects table: ${projects[0].count} records`);
    
    const [grades] = await connection.execute('SELECT COUNT(*) as count FROM grades');
    console.log(`✅ Grades table: ${grades[0].count} records`);
    
    const [books] = await connection.execute('SELECT COUNT(*) as count FROM books');
    console.log(`✅ Books table: ${books[0].count} records`);
    
    const [units] = await connection.execute('SELECT COUNT(*) as count FROM units');
    console.log(`✅ Units table: ${units[0].count} records`);
    
    const [lessons] = await connection.execute('SELECT COUNT(*) as count FROM lessons');
    console.log(`✅ Lessons table: ${lessons[0].count} records`);
    
    console.log('\n✅ All tests passed! Database is working correctly.');
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('\nCommon causes:');
    console.error('  1. Database does not exist');
    console.error('  2. User does not exist');
    console.error('  3. Wrong password');
    console.error('  4. User lacks permissions');
    console.error('  5. MySQL server not running');
    console.error('\nTo fix, run these SQL commands as root:');
    console.error(`  CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'workflow_db'};`);
    console.error(`  CREATE USER IF NOT EXISTS '${process.env.DB_USER || 'root'}'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';`);
    console.error(`  GRANT ALL PRIVILEGES ON ${process.env.DB_NAME || 'workflow_db'}.* TO '${process.env.DB_USER || 'root'}'@'localhost';`);
    console.error(`  FLUSH PRIVILEGES;`);
    process.exit(1);
  }
}

testConnection();
