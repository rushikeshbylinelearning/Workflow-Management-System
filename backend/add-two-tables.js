#!/usr/bin/env node

/**
 * Add 2 Missing Tables Script
 * Adds: task_time_logs and team_member_permissions
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function addTwoTables() {
  console.log('\n🔧 Adding 2 Missing Tables...\n');

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
    const sqlFile = path.join(__dirname, 'migrations', 'add_two_missing_tables.sql');
    console.log('📄 Reading SQL file:', sqlFile);
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error('SQL file not found: ' + sqlFile);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('✅ SQL file loaded\n');

    // Execute the SQL
    console.log('⚙️  Creating/Updating tables...\n');
    
    // We'll use a more robust approach: Drop and recreate to ensure correct schema
    // since these are newly added tables with no critical data yet.
    await connection.query('DROP TABLE IF EXISTS task_time_logs');
    await connection.query('DROP TABLE IF EXISTS team_member_permissions');

    const sqlFile = path.join(__dirname, 'migrations', 'add_two_missing_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await connection.query(sql);
    
    console.log('\n✅ Tables created successfully with CORRECT schema!\n');
    
    // Verify tables exist
    console.log('📋 Verifying tables...');
    const [tables] = await connection.query(`
      SELECT table_name, table_rows
      FROM information_schema.tables 
      WHERE table_schema = ? 
        AND table_name IN ('task_time_logs', 'team_member_permissions')
    `, [process.env.DB_NAME]);
    
    console.table(tables);

    console.log('\n🎉 Done! Tables added successfully.\n');

  } catch (error) {
    console.error('\n❌ Error adding tables:', error.message);
    
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('\n💡 Tables already exist. This is fine!\n');
    } else {
      console.error('\nFull error:', error);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed\n');
    }
  }
}

// Run the script
addTwoTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
