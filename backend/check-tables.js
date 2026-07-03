const db = require('./db');

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...\n');
    
    // Get all tables
    const tables = await db.query('SHOW TABLES');
    console.log('📋 Available tables:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    console.log('\n🔍 Checking specific tables for foreign keys:\n');
    
    // Check tasks table
    try {
      const tasksInfo = await db.query('DESCRIBE tasks');
      console.log('✅ tasks table exists:');
      tasksInfo.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '[PRIMARY KEY]' : ''}`);
      });
    } catch (err) {
      console.log('❌ tasks table does NOT exist');
    }
    
    console.log('');
    
    // Check projects table
    try {
      const projectsInfo = await db.query('DESCRIBE projects');
      console.log('✅ projects table exists:');
      projectsInfo.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '[PRIMARY KEY]' : ''}`);
      });
    } catch (err) {
      console.log('❌ projects table does NOT exist');
    }
    
    console.log('');
    
    // Check team_members table
    try {
      const membersInfo = await db.query('DESCRIBE team_members');
      console.log('✅ team_members table exists:');
      membersInfo.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '[PRIMARY KEY]' : ''}`);
      });
    } catch (err) {
      console.log('❌ team_members table does NOT exist');
    }
    
    console.log('');
    
    // Check admin_users table
    try {
      const adminInfo = await db.query('DESCRIBE admin_users');
      console.log('✅ admin_users table exists:');
      adminInfo.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '[PRIMARY KEY]' : ''}`);
      });
    } catch (err) {
      console.log('❌ admin_users table does NOT exist');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
