const db = require('./db');
require('dotenv').config();

/**
 * Diagnostic script to check hosted environment issues
 * Run this on your hosted server to identify problems
 */

async function diagnoseHostedEnvironment() {
  console.log('='.repeat(60));
  console.log('HOSTED ENVIRONMENT DIAGNOSTIC TOOL');
  console.log('='.repeat(60));
  console.log('');

  // 1. Check environment variables
  console.log('1. ENVIRONMENT VARIABLES:');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   PORT:', process.env.PORT);
  console.log('   DB_HOST:', process.env.DB_HOST);
  console.log('   DB_PORT:', process.env.DB_PORT);
  console.log('   DB_NAME:', process.env.DB_NAME);
  console.log('   DB_USER:', process.env.DB_USER);
  console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : '***NOT SET***');
  console.log('   CORS_ORIGIN:', process.env.CORS_ORIGIN);
  console.log('');

  // 2. Test database connection
  console.log('2. DATABASE CONNECTION TEST:');
  try {
    const connected = await db.testConnection();
    if (connected) {
      console.log('   ✅ Database connection successful');
    } else {
      console.log('   ❌ Database connection failed');
      return;
    }
  } catch (error) {
    console.log('   ❌ Database connection error:', error.message);
    return;
  }
  console.log('');

  // 3. Check if tasks table exists
  console.log('3. DATABASE TABLES CHECK:');
  try {
    const tables = await db.query('SHOW TABLES');
    console.log('   Found', tables.length, 'tables');
    const tableNames = tables.map(t => Object.values(t)[0]);
    const requiredTables = ['tasks', 'projects', 'task_assignees', 'task_skills', 'category_stages'];
    
    for (const table of requiredTables) {
      if (tableNames.includes(table)) {
        console.log('   ✅', table);
      } else {
        console.log('   ❌', table, '- MISSING!');
      }
    }
  } catch (error) {
    console.log('   ❌ Error checking tables:', error.message);
  }
  console.log('');

  // 4. Check task counts
  console.log('4. TASK DATA CHECK:');
  try {
    const taskCount = await db.query('SELECT COUNT(*) as count FROM tasks');
    console.log('   Total tasks:', taskCount[0].count);

    const statusCounts = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
    `);
    console.log('   Tasks by status:');
    statusCounts.forEach(row => {
      console.log('     -', row.status + ':', row.count);
    });

    const recentTasks = await db.query(`
      SELECT id, name, status, created_at 
      FROM tasks 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('   Recent 5 tasks:');
    recentTasks.forEach(task => {
      console.log('     - ID:', task.id, '| Name:', task.name, '| Status:', task.status);
    });
  } catch (error) {
    console.log('   ❌ Error checking tasks:', error.message);
  }
  console.log('');

  // 5. Test bulk delete functionality
  console.log('5. BULK DELETE TEST (DRY RUN):');
  try {
    // Find a task to test with (without actually deleting)
    const testTasks = await db.query('SELECT id FROM tasks LIMIT 1');
    if (testTasks.length > 0) {
      const testId = testTasks[0].id;
      console.log('   Test task ID:', testId);
      
      // Check if task exists
      const exists = await db.query('SELECT id, project_id FROM tasks WHERE id = ?', [testId]);
      console.log('   ✅ Task exists:', exists.length > 0);
      
      // Test the query that would be used in bulk delete
      const placeholders = '?';
      const query = `SELECT id, project_id FROM tasks WHERE id IN (${placeholders})`;
      const result = await db.query(query, [testId]);
      console.log('   ✅ Bulk delete query works:', result.length > 0);
    } else {
      console.log('   ⚠️  No tasks found to test with');
    }
  } catch (error) {
    console.log('   ❌ Error testing bulk delete:', error.message);
  }
  console.log('');

  // 6. Check for orphaned data
  console.log('6. DATA INTEGRITY CHECK:');
  try {
    const orphanedAssignees = await db.query(`
      SELECT COUNT(*) as count 
      FROM task_assignees ta 
      LEFT JOIN tasks t ON ta.task_id = t.id 
      WHERE t.id IS NULL
    `);
    console.log('   Orphaned task_assignees:', orphanedAssignees[0].count);

    const orphanedSkills = await db.query(`
      SELECT COUNT(*) as count 
      FROM task_skills ts 
      LEFT JOIN tasks t ON ts.task_id = t.id 
      WHERE t.id IS NULL
    `);
    console.log('   Orphaned task_skills:', orphanedSkills[0].count);
  } catch (error) {
    console.log('   ❌ Error checking data integrity:', error.message);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));

  await db.close();
  process.exit(0);
}

// Run diagnostics
diagnoseHostedEnvironment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
