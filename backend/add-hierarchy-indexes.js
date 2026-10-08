const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function addHierarchyIndexes() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'workflow_lms',
      multipleStatements: true
    });

    console.log('✅ Connected to database');
    console.log('📊 Adding indexes for educational hierarchy columns...');

    // Read and execute the migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add_hierarchy_indexes.sql'),
      'utf8'
    );

    await connection.query(migrationSQL);

    console.log('✅ Successfully added hierarchy indexes!');
    console.log('\n📋 Indexes created:');
    console.log('  - idx_grade_id on tasks(grade_id)');
    console.log('  - idx_book_id on tasks(book_id)');
    console.log('  - idx_unit_id on tasks(unit_id)');
    console.log('  - idx_lesson_id on tasks(lesson_id)');
    console.log('  - idx_hierarchy_composite on tasks(project_id, grade_id, book_id, unit_id, lesson_id)');
    console.log('\n✨ Performance improvement: Tag filters should now be much faster!\n');

  } catch (error) {
    console.error('❌ Error adding hierarchy indexes:', error.message);
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️  Some indexes may already exist - this is normal');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

addHierarchyIndexes();
