#!/usr/bin/env node

/**
 * Add Missing Tables Script
 * This script adds any missing tables to your database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function addMissingTables() {
  console.log('\n🔧 Adding Missing Tables to Database...\n');

  let connection;
  
  try {
    // Create database connection
    console.log('📡 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log(`✅ Connected to database: ${process.env.DB_NAME}\n`);

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'migrations', 'add_missing_tables.sql');
    console.log('📄 Reading SQL file:', sqlFile);
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error('SQL file not found: ' + sqlFile);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ SQL file loaded\n');

    // Execute the SQL
    console.log('⚙️  Executing SQL statements...\n');
    const [results] = await connection.query(sql);
    
    // Display results
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        if (result && result.length > 0) {
          console.log(`Result ${index + 1}:`);
          console.table(result);
        }
      });
    }

    console.log('\n✅ Missing tables added successfully!\n');
    
    // Show all tables
    console.log('📋 Current tables in database:');
    const [tables] = await connection.query('SHOW TABLES');
    console.table(tables);

    console.log('\n🎉 Done! You can now restart your application.\n');

  } catch (error) {
    console.error('\n❌ Error adding missing tables:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed\n');
    }
  }
}

// Run the script
addMissingTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
