#!/usr/bin/env node

/**
 * Migration Status Checker
 * 
 * Shows information about:
 * - Available migration files
 * - Database tables and their structure
 * - Migration history (if tracking table exists)
 * 
 * Usage:
 *   node migration-status.js
 *   node migration-status.js --tables
 *   node migration-status.js --files
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  return files.map(file => {
    const filepath = path.join(migrationsDir, file);
    const stats = fs.statSync(filepath);
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Extract description from file
    const descMatch = content.match(/--\s*Description:\s*(.+)/i);
    const description = descMatch ? descMatch[1].trim() : 'No description';
    
    return {
      filename: file,
      size: stats.size,
      modified: stats.mtime,
      description,
    };
  });
}

async function getDatabaseTables() {
  try {
    const tables = await db.query(`
      SELECT 
        table_name,
        table_rows,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        create_time,
        update_time
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);
    
    return tables;
  } catch (error) {
    return [];
  }
}

async function getTableColumns(tableName) {
  try {
    const columns = await db.query(`
      SELECT 
        column_name,
        column_type,
        is_nullable,
        column_key,
        column_default,
        extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY ordinal_position
    `, [tableName]);
    
    return columns;
  } catch (error) {
    return [];
  }
}

async function showMigrationFiles() {
  log('\n📁 MIGRATION FILES', 'bright');
  log('='.repeat(80), 'cyan');
  
  const files = await getMigrationFiles();
  
  if (files.length === 0) {
    log('No migration files found', 'yellow');
    return;
  }
  
  files.forEach((file, index) => {
    const num = String(index + 1).padStart(2, '0');
    const size = `${(file.size / 1024).toFixed(2)} KB`;
    const date = file.modified.toISOString().split('T')[0];
    
    log(`\n${num}. ${file.filename}`, 'cyan');
    log(`    ${file.description}`, 'white');
    log(`    Size: ${size} | Modified: ${date}`, 'dim');
  });
  
  log('\n' + '='.repeat(80), 'cyan');
  log(`Total: ${files.length} migration file(s)`, 'green');
}

async function showDatabaseTables() {
  log('\n🗄️  DATABASE TABLES', 'bright');
  log('='.repeat(80), 'cyan');
  
  const tables = await getDatabaseTables();
  
  if (tables.length === 0) {
    log('No tables found in database', 'yellow');
    return;
  }
  
  // Group tables by prefix
  const grouped = {};
  tables.forEach(table => {
    const prefix = table.table_name.split('_')[0];
    if (!grouped[prefix]) {
      grouped[prefix] = [];
    }
    grouped[prefix].push(table);
  });
  
  for (const [prefix, prefixTables] of Object.entries(grouped)) {
    log(`\n📊 ${prefix.toUpperCase()} Tables:`, 'yellow');
    
    prefixTables.forEach(table => {
      const rows = String(table.table_rows).padStart(8, ' ');
      const size = String(table.size_mb).padStart(8, ' ');
      
      log(`  • ${table.table_name.padEnd(30)} | Rows: ${rows} | Size: ${size} MB`, 'white');
    });
  }
  
  log('\n' + '='.repeat(80), 'cyan');
  log(`Total: ${tables.length} table(s)`, 'green');
}

async function showTableDetails(tableName) {
  log(`\n📋 TABLE: ${tableName}`, 'bright');
  log('='.repeat(80), 'cyan');
  
  const columns = await getTableColumns(tableName);
  
  if (columns.length === 0) {
    log('Table not found or no columns', 'red');
    return;
  }
  
  log('\nColumns:', 'yellow');
  columns.forEach(col => {
    const key = col.column_key ? `[${col.column_key}]` : '';
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const extra = col.extra ? `(${col.extra})` : '';
    
    log(`  • ${col.column_name.padEnd(25)} ${col.column_type.padEnd(20)} ${nullable.padEnd(10)} ${key} ${extra}`, 'white');
  });
  
  log('\n' + '='.repeat(80), 'cyan');
}

async function showDatabaseInfo() {
  try {
    const dbInfo = await db.queryFirst(`
      SELECT 
        DATABASE() as database_name,
        @@version as mysql_version,
        @@character_set_database as charset,
        @@collation_database as collation
    `);
    
    const tableCount = await db.queryFirst(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    const dbSize = await db.queryFirst(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    
    log('\n💾 DATABASE INFORMATION', 'bright');
    log('='.repeat(80), 'cyan');
    log(`Database: ${dbInfo.database_name}`, 'white');
    log(`MySQL Version: ${dbInfo.mysql_version}`, 'white');
    log(`Character Set: ${dbInfo.charset}`, 'white');
    log(`Collation: ${dbInfo.collation}`, 'white');
    log(`Tables: ${tableCount.count}`, 'white');
    log(`Total Size: ${dbSize.size_mb} MB`, 'white');
    log('='.repeat(80), 'cyan');
    
  } catch (error) {
    log('Error getting database info', 'red');
  }
}

async function showFullStatus() {
  log('\n' + '='.repeat(80), 'cyan');
  log('📊 DATABASE MIGRATION STATUS', 'bright');
  log('='.repeat(80), 'cyan');
  
  // Test connection
  log('\n🔌 Testing database connection...', 'yellow');
  const connected = await db.testConnection();
  
  if (!connected) {
    log('❌ Cannot connect to database', 'red');
    log('\nCheck your .env file and ensure database is running', 'yellow');
    process.exit(1);
  }
  
  // Show database info
  await showDatabaseInfo();
  
  // Show migration files
  await showMigrationFiles();
  
  // Show database tables
  await showDatabaseTables();
  
  log('\n' + '='.repeat(80), 'cyan');
  log('✅ Status check completed', 'green');
  log('='.repeat(80) + '\n', 'cyan');
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--help') || args.includes('-h')) {
      log('\n📖 Migration Status Checker', 'bright');
      log('\nUsage:', 'yellow');
      log('  node migration-status.js              Show full status', 'cyan');
      log('  node migration-status.js --files      Show migration files only', 'cyan');
      log('  node migration-status.js --tables     Show database tables only', 'cyan');
      log('  node migration-status.js --table NAME Show specific table details', 'cyan');
      log('  node migration-status.js --help       Show this help\n', 'cyan');
      process.exit(0);
    }
    
    if (args.includes('--files')) {
      await showMigrationFiles();
    } else if (args.includes('--tables')) {
      await db.testConnection();
      await showDatabaseTables();
    } else if (args.includes('--table')) {
      const tableIndex = args.indexOf('--table');
      const tableName = args[tableIndex + 1];
      
      if (!tableName) {
        log('❌ Please specify a table name', 'red');
        log('Usage: node migration-status.js --table table_name', 'yellow');
        process.exit(1);
      }
      
      await db.testConnection();
      await showTableDetails(tableName);
    } else {
      await showFullStatus();
    }
    
  } catch (error) {
    log('\n❌ Error:', 'red');
    log(error.message, 'red');
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
