#!/usr/bin/env node

/**
 * Migration Rollback Helper
 * 
 * Helps create rollback migrations by analyzing existing tables and generating
 * reverse SQL statements for common operations.
 * 
 * Usage:
 *   node rollback-helper.js --table table_name
 *   node rollback-helper.js --column table_name column_name
 *   node rollback-helper.js --index table_name index_name
 */

const db = require('./db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getTableStructure(tableName) {
  try {
    const result = await db.query(`SHOW CREATE TABLE ${tableName}`);
    return result[0]['Create Table'];
  } catch (error) {
    return null;
  }
}

async function getColumnInfo(tableName, columnName) {
  try {
    const columns = await db.query(`
      SELECT 
        column_name,
        column_type,
        is_nullable,
        column_default,
        extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `, [tableName, columnName]);
    
    return columns[0] || null;
  } catch (error) {
    return null;
  }
}

async function getIndexInfo(tableName, indexName) {
  try {
    const indexes = await db.query(`
      SHOW INDEX FROM ${tableName} WHERE Key_name = ?
    `, [indexName]);
    
    return indexes;
  } catch (error) {
    return null;
  }
}

async function generateTableRollback(tableName) {
  log('\n📋 ROLLBACK: Drop Table', 'bright');
  log('='.repeat(60), 'cyan');
  
  const structure = await getTableStructure(tableName);
  
  if (!structure) {
    log(`❌ Table '${tableName}' not found`, 'red');
    return;
  }
  
  log(`\nTable: ${tableName}`, 'cyan');
  log('\nRollback SQL:', 'yellow');
  log(`DROP TABLE IF EXISTS ${tableName};`, 'green');
  
  log('\nTo recreate the table later, use:', 'yellow');
  log(structure, 'cyan');
}

async function generateColumnRollback(tableName, columnName) {
  log('\n📋 ROLLBACK: Drop Column', 'bright');
  log('='.repeat(60), 'cyan');
  
  const column = await getColumnInfo(tableName, columnName);
  
  if (!column) {
    log(`❌ Column '${columnName}' not found in table '${tableName}'`, 'red');
    return;
  }
  
  log(`\nTable: ${tableName}`, 'cyan');
  log(`Column: ${columnName}`, 'cyan');
  
  log('\nRollback SQL:', 'yellow');
  log(`ALTER TABLE ${tableName} DROP COLUMN ${columnName};`, 'green');
  
  log('\nTo recreate the column later, use:', 'yellow');
  const nullable = column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
  const defaultVal = column.column_default ? `DEFAULT ${column.column_default}` : '';
  const extra = column.extra || '';
  
  log(`ALTER TABLE ${tableName}`, 'cyan');
  log(`ADD COLUMN ${columnName} ${column.column_type} ${nullable} ${defaultVal} ${extra};`, 'cyan');
}

async function generateIndexRollback(tableName, indexName) {
  log('\n📋 ROLLBACK: Drop Index', 'bright');
  log('='.repeat(60), 'cyan');
  
  const indexes = await getIndexInfo(tableName, indexName);
  
  if (!indexes || indexes.length === 0) {
    log(`❌ Index '${indexName}' not found in table '${tableName}'`, 'red');
    return;
  }
  
  log(`\nTable: ${tableName}`, 'cyan');
  log(`Index: ${indexName}`, 'cyan');
  
  log('\nRollback SQL:', 'yellow');
  log(`DROP INDEX ${indexName} ON ${tableName};`, 'green');
  
  log('\nTo recreate the index later, use:', 'yellow');
  const columns = indexes.map(idx => idx.Column_name).join(', ');
  const unique = indexes[0].Non_unique === 0 ? 'UNIQUE ' : '';
  
  log(`CREATE ${unique}INDEX ${indexName} ON ${tableName}(${columns});`, 'cyan');
}

async function showHelp() {
  log('\n📖 Migration Rollback Helper', 'bright');
  log('\nUsage:', 'yellow');
  log('  node rollback-helper.js --table <table_name>', 'cyan');
  log('  node rollback-helper.js --column <table_name> <column_name>', 'cyan');
  log('  node rollback-helper.js --index <table_name> <index_name>', 'cyan');
  
  log('\nExamples:', 'yellow');
  log('  node rollback-helper.js --table user_preferences', 'cyan');
  log('  node rollback-helper.js --column team_members avatar_url', 'cyan');
  log('  node rollback-helper.js --index tasks idx_status', 'cyan');
  
  log('\nCommon Rollback Patterns:', 'yellow');
  log('  • Drop table: DROP TABLE IF EXISTS table_name;', 'cyan');
  log('  • Drop column: ALTER TABLE table_name DROP COLUMN column_name;', 'cyan');
  log('  • Drop index: DROP INDEX index_name ON table_name;', 'cyan');
  log('  • Drop foreign key: ALTER TABLE table_name DROP FOREIGN KEY fk_name;', 'cyan');
  log('');
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      await showHelp();
      process.exit(0);
    }
    
    // Test connection
    const connected = await db.testConnection();
    if (!connected) {
      log('❌ Cannot connect to database', 'red');
      process.exit(1);
    }
    
    if (args[0] === '--table' && args[1]) {
      await generateTableRollback(args[1]);
    } else if (args[0] === '--column' && args[1] && args[2]) {
      await generateColumnRollback(args[1], args[2]);
    } else if (args[0] === '--index' && args[1] && args[2]) {
      await generateIndexRollback(args[1], args[2]);
    } else {
      log('❌ Invalid arguments', 'red');
      await showHelp();
      process.exit(1);
    }
    
    log('\n' + '='.repeat(60) + '\n', 'cyan');
    
  } catch (error) {
    log('\n❌ Error:', 'red');
    log(error.message, 'red');
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
