const mysql = require('mysql2/promise');
require('dotenv').config();

async function dropTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'workflow_db'
    });

    console.log('✅ Connected to database');
    console.log('⚠️  Dropping all tables...');

    // Disable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop tables in reverse order
    const tables = [
      'activity_logs',
      'notifications',
      'time_logs',
      'task_comments',
      'tasks',
      'stages',
      'projects',
      'team_member_assignments',
      'teams',
      'team_members',
      'admin_users'
    ];

    for (const table of tables) {
      try {
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`  ✓ Dropped ${table}`);
      } catch (err) {
        console.log(`  ⚠ Could not drop ${table}: ${err.message}`);
      }
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ All tables dropped successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

dropTables();
