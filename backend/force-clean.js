const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceClean() {
  let connection;
  
  try {
    // Connect to MySQL server (not to specific database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✅ Connected to MySQL server');
    
    const dbName = process.env.DB_NAME || 'workflow_db';
    
    // Use the database
    await connection.query(`USE ${dbName}`);
    
    console.log('🧹 Force cleaning all tables...\n');

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('   No tables found in database');
    } else {
      // Disable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        try {
          await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
          console.log(`  ✓ Dropped ${tableName}`);
        } catch (err) {
          console.log(`  ⚠ Could not drop ${tableName}: ${err.message}`);
        }
      }
      
      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('\n✅ Database cleaned!');
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

forceClean();
