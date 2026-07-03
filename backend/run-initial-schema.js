const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runInitialSchema() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'workflow_db'
    });

    console.log('✅ Connected to database');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'migrations', '00_initial_schema.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Remove comments and split by semicolons
    const statements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short statements

    console.log('📄 Running initial schema migration...');
    console.log(`   Found ${statements.length} SQL statements\n`);

    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await connection.query(statement);
          if (statement.includes('CREATE TABLE')) {
            const match = statement.match(/CREATE TABLE.*?`?(\w+)`?\s*\(/i);
            const tableName = match ? match[1] : 'unknown';
            console.log(`   ✓ Created table: ${tableName}`);
          } else if (statement.includes('ALTER TABLE')) {
            const match = statement.match(/ALTER TABLE\s+`?(\w+)`?/i);
            const tableName = match ? match[1] : 'unknown';
            console.log(`   ✓ Added constraints to: ${tableName}`);
          } else if (statement.includes('INSERT INTO')) {
            console.log(`   ✓ Inserted default admin user`);
          } else if (statement.includes('SELECT')) {
            const result = await connection.query(statement);
            if (result[0] && result[0][0]) {
              console.log(`   ✓ ${result[0][0].message || 'Success'}`);
            }
          }
        } catch (error) {
          console.error(`\n   ❌ Error executing statement ${i + 1}:`, error.message);
          console.error(`   Statement preview: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }

    console.log('\n✅ Initial schema created successfully!');
    console.log('\n📝 Default admin credentials:');
    console.log('   Email: admin@workflow.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runInitialSchema();
