const db = require('./db');

async function checkTaskCount() {
  try {
    console.log('=== TASK COUNT DIAGNOSTIC ===\n');

    // Test connection
    await db.testConnection();

    // Get total task count
    const totalCount = await db.queryFirst('SELECT COUNT(*) as total FROM tasks');
    console.log('Total tasks in database:', totalCount.total);

    // Get count by status
    const statusCounts = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('\nTasks by status:');
    statusCounts.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Get recently created tasks (last 10)
    const recentTasks = await db.query(`
      SELECT id, name, status, created_at 
      FROM tasks 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log('\nMost recently created tasks:');
    recentTasks.forEach(task => {
      console.log(`  ID: ${task.id}, Name: ${task.name}, Status: ${task.status}, Created: ${task.created_at}`);
    });

    // Check for duplicate tasks
    const duplicates = await db.query(`
      SELECT name, project_id, category_stage_id, COUNT(*) as count
      FROM tasks
      GROUP BY name, project_id, category_stage_id
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\nPotential duplicate tasks:');
    if (duplicates.length === 0) {
      console.log('  No duplicates found');
    } else {
      duplicates.forEach(dup => {
        console.log(`  "${dup.name}" - ${dup.count} copies`);
      });
    }

    // Check dashboard query result
    const dashboardStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'not-started')  AS not_started,
        SUM(status = 'in-progress')  AS in_progress,
        SUM(status = 'under-review') AS under_review,
        SUM(status = 'completed')    AS completed,
        SUM(status = 'blocked')      AS blocked,
        SUM(status = 'skipped')      AS skipped
      FROM tasks
    `);
    console.log('\nDashboard KPI stats:');
    console.log('  Total:', dashboardStats.total);
    console.log('  Not Started:', dashboardStats.not_started);
    console.log('  In Progress:', dashboardStats.in_progress);
    console.log('  Under Review:', dashboardStats.under_review);
    console.log('  Completed:', dashboardStats.completed);
    console.log('  Blocked:', dashboardStats.blocked);
    console.log('  Skipped:', dashboardStats.skipped);

    // Check if there are any NULL or invalid status values
    const invalidStatus = await db.query(`
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE status IS NULL OR status NOT IN ('not-started', 'in-progress', 'under-review', 'completed', 'blocked', 'skipped')
      GROUP BY status
    `);
    console.log('\nInvalid status values:');
    if (invalidStatus.length === 0) {
      console.log('  None found - all statuses are valid');
    } else {
      invalidStatus.forEach(row => {
        console.log(`  Status: "${row.status}" - Count: ${row.count}`);
      });
    }

    await db.close();
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
  } catch (error) {
    console.error('Error during diagnostic:', error);
    process.exit(1);
  }
}

checkTaskCount();
