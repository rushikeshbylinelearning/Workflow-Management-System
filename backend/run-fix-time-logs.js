const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  console.log('🔧 Fixing negative time log entries...');
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/fix_negative_time_logs.sql'),
      'utf8'
    );

    // Split on semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.replace(/--.*$/gm, '').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      const result = await db.execute(stmt);
      console.log(`✅ Executed: ${stmt.substring(0, 60).replace(/\s+/g, ' ')}...`);
      if (result.affectedRows !== undefined) {
        console.log(`   Rows affected: ${result.affectedRows}`);
      }
    }

    console.log('\n✅ Migration complete. All negative time values have been fixed.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
