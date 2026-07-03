/**
 * Quick script to check task count
 * Run this immediately after bulk upload to verify tasks were created
 */

const db = require('./db');

async function quickCheck() {
  try {
    await db.testConnection();
    
    const count = await db.queryFirst('SELECT COUNT(*) as total FROM tasks');
    console.log('\n✅ Total tasks in database:', count.total);
    
    const recent = await db.query('SELECT id, name, created_at FROM tasks ORDER BY id DESC LIMIT 6');
    console.log('\n📋 Last 6 tasks created:');
    recent.forEach((task, i) => {
      console.log(`   ${i + 1}. [ID: ${task.id}] ${task.name.substring(0, 60)}... (${task.created_at})`);
    });
    
    await db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
