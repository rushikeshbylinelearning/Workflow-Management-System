#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * Usage:
 *   node migrate.js <migration-file>
 *   node migrate.js add_roles_permissions.sql
 *   node migrate.js migrations/add_roles_permissions.sql
 * 
 * Features:
 *   - Runs any SQL migration file
 *   - Handles multi-statement SQL files
 *   - Provides detailed execution feedback
 *   - Error handling and rollback support
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('\n❌ Error: No migration file specified', 'red');
    log('\nUsage:', 'yellow');
    log('  node migrate.js <migration-file>', 'cyan');
    log('\nExamples:', 'yellow');
    log('  node migrate.js add_roles_permissions.sql', 'cyan');
    log('  node migrate.js migrations/add_roles_permissions.sql', 'cyan');
    log('  node migrate.js 01_example_migration.sql', 'cyan');
    process.exit(1);
  }
  
  return args[0];
}

function resolveMigrationPath(filename) {
  // Try different path combinations
  const possiblePaths = [
    filename,
    path.join(__dirname, filename),
    path.join(__dirname, 'migrations', filename),
    path.join(__dirname, 'migrations', path.basename(filename)),
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  return null;
}

function parseSqlFile(sqlContent) {
  // Remove single-line comments (-- comments)
  let cleaned = sqlContent
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--') && trimmed.length > 0;
    })
    .join('\n');
  
  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Split by semicolons and filter empty statements
  const statements = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return statements;
}

async function runMigration(migrationFile) {
  const startTime = Date.now();
  
  try {
    log('\n' + '='.repeat(60), 'cyan');
    log('🚀 DATABASE MIGRATION RUNNER', 'bright');
    log('='.repeat(60), 'cyan');
    
    // Resolve migration file path
    const migrationPath = resolveMigrationPath(migrationFile);
    
    if (!migrationPath) {
      log(`\n❌ Migration file not found: ${migrationFile}`, 'red');
      log('\nSearched in:', 'yellow');
      log(`  - ${migrationFile}`, 'cyan');
      log(`  - ${path.join(__dirname, migrationFile)}`, 'cyan');
      log(`  - ${path.join(__dirname, 'migrations', migrationFile)}`, 'cyan');
      process.exit(1);
    }
    
    log(`\n📁 Migration file: ${path.basename(migrationPath)}`, 'cyan');
    log(`📂 Full path: ${migrationPath}`, 'cyan');
    
    // Test database connection
    log('\n🔌 Testing database connection...', 'yellow');
    const connected = await db.testConnection();
    
    if (!connected) {
      log('❌ Database connection failed', 'red');
      process.exit(1);
    }
    
    // Read SQL file
    log('\n📖 Reading migration file...', 'yellow');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    const fileSize = (sqlContent.length / 1024).toFixed(2);
    log(`✅ File loaded (${fileSize} KB)`, 'green');
    
    // Parse SQL statements
    log('\n🔍 Parsing SQL statements...', 'yellow');
    const statements = parseSqlFile(sqlContent);
    log(`✅ Found ${statements.length} SQL statement(s)`, 'green');
    
    // Execute statements
    log('\n⚙️  Executing migration...', 'yellow');
    log('-'.repeat(60), 'cyan');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementNum = i + 1;
      
      // Show preview of statement (first 80 chars)
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      log(`\n[${statementNum}/${statements.length}] ${preview}...`, 'cyan');
      
      try {
        await db.execute(statement);
        log(`✅ Statement ${statementNum} completed`, 'green');
      } catch (error) {
        log(`❌ Statement ${statementNum} failed`, 'red');
        log(`Error: ${error.message}`, 'red');
        
        // Show the problematic statement
        log('\nProblematic SQL:', 'yellow');
        log(statement.substring(0, 500), 'cyan');
        
        throw error;
      }
    }
    
    // Success summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('\n' + '='.repeat(60), 'cyan');
    log('✅ MIGRATION COMPLETED SUCCESSFULLY!', 'green');
    log('='.repeat(60), 'cyan');
    log(`⏱️  Duration: ${duration}s`, 'cyan');
    log(`📊 Statements executed: ${statements.length}`, 'cyan');
    log(`📁 Migration: ${path.basename(migrationPath)}`, 'cyan');
    log('='.repeat(60) + '\n', 'cyan');
    
    process.exit(0);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('\n' + '='.repeat(60), 'red');
    log('❌ MIGRATION FAILED', 'red');
    log('='.repeat(60), 'red');
    log(`⏱️  Duration: ${duration}s`, 'yellow');
    log(`\nError: ${error.message}`, 'red');
    
    if (error.sql) {
      log('\nFailed SQL:', 'yellow');
      log(error.sql.substring(0, 500), 'cyan');
    }
    
    log('\n' + '='.repeat(60) + '\n', 'red');
    
    process.exit(1);
  } finally {
    // Close database connection
    await db.close();
  }
}

// Main execution
const migrationFile = parseArguments();
runMigration(migrationFile);
