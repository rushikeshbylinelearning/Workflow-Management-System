const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetDatabase() {
  let connection;
  
  try {
    // Connect without selecting a database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✅ Connected to MySQL server');
    
    const dbName = process.env.DB_NAME || 'workflow_db';
    
    console.log(`⚠️  Dropping database: ${dbName}`);
    await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✓ Database dropped`);
    
    console.log(`📦 Creating database: ${dbName}`);
    await connection.query(`CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ Database created`);
    
    console.log('\n✅ Database reset successfully!');
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

resetDatabase();
