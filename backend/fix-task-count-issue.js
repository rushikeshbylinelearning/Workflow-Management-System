/**
 * This script helps diagnose and fix the task count discrepancy issue
 * Run this on your hosted environment to check what's happening
 */

const db = require('./db');

async function diagnoseTaskCountIssue() {
  try {
    console.log('=== TASK COUNT ISSUE DIAGNOSTIC ===\n');

    // Test connection
    const connected = await db.testConnection();
    if (!connected) {
      console.error('Cannot connect to database. Check your .env file.');
      process.exit(1);
    }

    // 1. Get the exact count that dashboard API returns
    console.log('1. Dashboard API Query Result:');
    const dashboardStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'not-started')  AS not_started,
        SUM(status = 'in-progress')  AS in_progress,
        SUM(status = 'under-review') AS under_review,
        SUM(status = 'completed')    AS completed,
        SUM(status = 'blocked')      AS blocked,
        SUM(status = 'skipped')      AS skipped,
        SUM(due_date < CURDATE() AND status NOT IN ('completed','skipped')) AS overdue
      FROM tasks
    `);
    console.log('   Dashboard shows:', JSON.stringify(dashboardStats, null, 2));

    // 2. Get simple count
    const simpleCount = await db.queryFirst('SELECT COUNT(*) as total FROM tasks');
    console.log('\n2. Simple COUNT(*) from tasks table:', simpleCount.total);

    // 3. Check for recently created tasks
    console.log('\n3. Recently created tasks (last 20):');
    const recentTasks = await db.query(`
      SELECT id, name, status, project_id, created_at 
      FROM tasks 
      ORDER BY id DESC 
      LIMIT 20
    `);
    recentTasks.forEach((task, idx) => {
      console.log(`   ${idx + 1}. ID: ${task.id}, Name: "${task.name.substring(0, 50)}...", Status: ${task.status}, Created: ${task.created_at}`);
    });

    // 4. Check for tasks created today
    const todayTasks = await db.query(`
      SELECT COUNT(*) as count, status
      FROM tasks 
      WHERE DATE(created_at) = CURDATE()
      GROUP BY status
    `);
    console.log('\n4. Tasks created today:');
    if (todayTasks.length === 0) {
      console.log('   No tasks created today');
    } else {
      todayTasks.forEach(row => {
        console.log(`   ${row.status}: ${row.count}`);
      });
    }

    // 5. Check for NULL or invalid values that might affect COUNT
    const nullChecks = await db.queryFirst(`
      SELECT
        SUM(CASE WHEN id IS NULL THEN 1 ELSE 0 END) as null_ids,
        SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status,
        SUM(CASE WHEN project_id IS NULL THEN 1 ELSE 0 END) as null_project
      FROM tasks
    `);
    console.log('\n5. NULL value checks:');
    console.log('   NULL IDs:', nullChecks.null_ids);
    console.log('   NULL Status:', nullChecks.null_status);
    console.log('   NULL Project IDs:', nullChecks.null_project);

    // 6. Check table status
    const tableStatus = await db.query('SHOW TABLE STATUS LIKE "tasks"');
    if (tableStatus.length > 0) {
      console.log('\n6. Table Status:');
      console.log('   Rows (approximate):', tableStatus[0].Rows);
      console.log('   Auto Increment:', tableStatus[0].Auto_increment);
      console.log('   Data Length:', tableStatus[0].Data_length);
    }

    // 7. Check for gaps in IDs (might indicate deleted tasks)
    const idStats = await db.queryFirst(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as actual_count,
        (MAX(id) - MIN(id) + 1) as expected_count,
        (MAX(id) - MIN(id) + 1 - COUNT(*)) as missing_ids
      FROM tasks
    `);
    console.log('\n7. ID Range Analysis:');
    console.log('   Min ID:', idStats.min_id);
    console.log('   Max ID:', idStats.max_id);
    console.log('   Actual Count:', idStats.actual_count);
    console.log('   Expected Count (if no gaps):', idStats.expected_count);
    console.log('   Missing IDs (deleted tasks):', idStats.missing_ids);

    // 8. Check for duplicate task names (might indicate re-creation)
    const duplicates = await db.query(`
      SELECT name, COUNT(*) as count
      FROM tasks
      GROUP BY name
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\n8. Duplicate task names (top 10):');
    if (duplicates.length === 0) {
      console.log('   No duplicates found');
    } else {
      duplicates.forEach(dup => {
        console.log(`   "${dup.name.substring(0, 50)}..." - ${dup.count} copies`);
      });
    }

    // 9. Check tasks by project
    const tasksByProject = await db.query(`
      SELECT p.name as project_name, COUNT(t.id) as task_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id
      ORDER BY task_count DESC
      LIMIT 10
    `);
    console.log('\n9. Tasks by project (top 10):');
    tasksByProject.forEach(row => {
      console.log(`   ${row.project_name}: ${row.task_count} tasks`);
    });

    // 10. Verify the 6 tasks you just uploaded
    console.log('\n10. Looking for your 6 recently uploaded tasks:');
    console.log('    (Tasks with "Social Science" project and "Lesson Design" in name)');
    const yourTasks = await db.query(`
      SELECT t.id, t.name, t.status, p.name as project_name, t.created_at
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE p.name LIKE '%Social Science%'
        AND t.name LIKE '%Lesson Design%'
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    if (yourTasks.length === 0) {
      console.log('    No matching tasks found');
    } else {
      yourTasks.forEach((task, idx) => {
        console.log(`    ${idx + 1}. ID: ${task.id}, Name: "${task.name}", Created: ${task.created_at}`);
      });
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    console.log('\nRECOMMENDATIONS:');
    console.log('1. If the simple COUNT matches the dashboard total, the issue is frontend caching');
    console.log('2. If there are many missing IDs, tasks may have been deleted');
    console.log('3. If your 6 tasks appear in section 10, they were created successfully');
    console.log('4. Try hard-refreshing the dashboard (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('5. Check browser console for any JavaScript errors');

    await db.close();
  } catch (error) {
    console.error('Error during diagnostic:', error);
    process.exit(1);
  }
}

diagnoseTaskCountIssue();
