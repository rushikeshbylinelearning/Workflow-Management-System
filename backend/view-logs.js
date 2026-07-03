#!/usr/bin/env node

/**
 * Log Viewer Script
 * View and manage application logs
 */

const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const logFiles = logger.getLogFiles();

function displayMenu() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 LOG VIEWER');
  console.log('='.repeat(60));
  console.log('\n1. View Error Log');
  console.log('2. View All Logs');
  console.log('3. View Access Log');
  console.log('4. View Database Log');
  console.log('5. View Last 50 Lines (Error Log)');
  console.log('6. View Last 50 Lines (All Logs)');
  console.log('7. Search Logs');
  console.log('8. Clear All Logs');
  console.log('9. Rotate Logs');
  console.log('10. Log File Sizes');
  console.log('0. Exit\n');
}

function viewLog(filePath, lines = null) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Log file not found: ${filePath}\n`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!content) {
      console.log('\n📄 Log file is empty\n');
      return;
    }

    if (lines) {
      const allLines = content.split('\n');
      const lastLines = allLines.slice(-lines).join('\n');
      console.log('\n' + lastLines + '\n');
    } else {
      console.log('\n' + content + '\n');
    }
  } catch (error) {
    console.error('Error reading log file:', error.message);
  }
}

function searchLogs(searchTerm) {
  console.log(`\n🔍 Searching for: "${searchTerm}"\n`);
  
  Object.entries(logFiles).forEach(([name, filePath]) => {
    try {
      if (!fs.existsSync(filePath)) return;
      
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const matches = lines.filter(line => 
        line.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matches.length > 0) {
        console.log(`\n📁 ${name.toUpperCase()} LOG (${matches.length} matches):`);
        console.log('-'.repeat(60));
        matches.slice(0, 10).forEach(match => {
          console.log(match.substring(0, 200));
        });
        if (matches.length > 10) {
          console.log(`\n... and ${matches.length - 10} more matches`);
        }
      }
    } catch (error) {
      console.error(`Error searching ${name} log:`, error.message);
    }
  });
  
  console.log('');
}

function getLogSizes() {
  console.log('\n📊 LOG FILE SIZES:\n');
  
  Object.entries(logFiles).forEach(([name, filePath]) => {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`${name.padEnd(15)}: ${sizeKB} KB (${sizeMB} MB)`);
      } else {
        console.log(`${name.padEnd(15)}: File not found`);
      }
    } catch (error) {
      console.log(`${name.padEnd(15)}: Error reading file`);
    }
  });
  
  console.log('');
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // If arguments provided, execute command directly
  if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
      case 'error':
        viewLog(logFiles.error);
        break;
      case 'all':
        viewLog(logFiles.all);
        break;
      case 'access':
        viewLog(logFiles.access);
        break;
      case 'database':
        viewLog(logFiles.database);
        break;
      case 'tail':
        const lines = args[1] || 50;
        viewLog(logFiles.error, parseInt(lines));
        break;
      case 'search':
        if (args[1]) {
          searchLogs(args[1]);
        } else {
          console.log('Usage: node view-logs.js search <term>');
        }
        break;
      case 'clear':
        logger.clearLogs();
        console.log('✅ All logs cleared');
        break;
      case 'rotate':
        logger.rotateLogs();
        console.log('✅ Logs rotated');
        break;
      case 'size':
        getLogSizes();
        break;
      default:
        console.log('Unknown command. Available commands:');
        console.log('  error, all, access, database, tail [lines], search <term>, clear, rotate, size');
    }
    return;
  }
  
  // Interactive mode
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function prompt() {
    displayMenu();
    rl.question('Select option: ', (answer) => {
      console.log('');
      
      switch (answer.trim()) {
        case '1':
          viewLog(logFiles.error);
          prompt();
          break;
        case '2':
          viewLog(logFiles.all);
          prompt();
          break;
        case '3':
          viewLog(logFiles.access);
          prompt();
          break;
        case '4':
          viewLog(logFiles.database);
          prompt();
          break;
        case '5':
          viewLog(logFiles.error, 50);
          prompt();
          break;
        case '6':
          viewLog(logFiles.all, 50);
          prompt();
          break;
        case '7':
          rl.question('Enter search term: ', (term) => {
            searchLogs(term);
            prompt();
          });
          break;
        case '8':
          rl.question('Are you sure you want to clear all logs? (yes/no): ', (confirm) => {
            if (confirm.toLowerCase() === 'yes') {
              logger.clearLogs();
              console.log('✅ All logs cleared\n');
            } else {
              console.log('❌ Cancelled\n');
            }
            prompt();
          });
          break;
        case '9':
          logger.rotateLogs();
          console.log('✅ Logs rotated\n');
          prompt();
          break;
        case '10':
          getLogSizes();
          prompt();
          break;
        case '0':
          console.log('Goodbye!\n');
          rl.close();
          break;
        default:
          console.log('Invalid option\n');
          prompt();
      }
    });
  }
  
  prompt();
}

// Run
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
