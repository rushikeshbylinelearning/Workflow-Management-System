const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanTablespaces() {
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
    console.log('🧹 Cleaning up tablespaces...\n');

    const tables = [
      'admin_users',
      'team_members',
      'teams',
      'team_member_assignments',
      'projects',
      'stages',
      'tasks',
      'task_comments',
      'time_logs',
      'notifications',
      'activity_logs'
    ];

    for (const table of tables) {
      try {
        // Try to discard tablespace
        await connection.query(`ALTER TABLE ${table} DISCARD TABLESPACE`);
        console.log(`  ✓ Discarded tablespace for ${table}`);
      } catch (err) {
        // Table doesn't exist or already discarded, that's fine
        console.log(`  ⚠ ${table}: ${err.message}`);
      }
    }

    console.log('\n✅ Tablespace cleanup complete!');
    console.log('   Now run: node run-initial-schema.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

cleanTablespaces();
