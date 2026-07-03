const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add_roles_permissions.sql');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'migrations', 'add_roles_permissions.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Remove comments and split by semicolons
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`);
        await db.execute(statement);
        console.log(`✅ Statement ${i + 1} completed`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
