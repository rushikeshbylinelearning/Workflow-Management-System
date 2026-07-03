const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add_task_time_tracking.sql');

    const sqlFile = path.join(__dirname, 'migrations', 'add_task_time_tracking.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Strip comment lines, split on semicolons
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`⚙️  [${i + 1}/${statements.length}] ${stmt.substring(0, 80)}...`);
      await db.execute(stmt);
      console.log(`✅ Done\n`);
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
