const db = require('./db');

async function diagnoseGrades() {
  try {
    console.log('🔍 Diagnosing Educational Hierarchy Data...\n');
    
    // Test connection
    console.log('1. Testing database connection...');
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed!');
      process.exit(1);
    }
    console.log('✅ Database connected\n');
    
    // Check projects
    console.log('2. Checking projects...');
    const projects = await db.query('SELECT id, name FROM projects LIMIT 5');
    console.log(`   Found ${projects.length} projects:`);
    projects.forEach(p => console.log(`   - ID: ${p.id}, Name: ${p.name}`));
    console.log('');
    
    // Check grades
    console.log('3. Checking grades...');
    const grades = await db.query('SELECT id, name, project_id FROM grades LIMIT 10');
    console.log(`   Found ${grades.length} grades:`);
    grades.forEach(g => console.log(`   - ID: ${g.id}, Name: ${g.name}, Project ID: ${g.project_id}`));
    console.log('');
    
    // Check grades by project
    if (projects.length > 0) {
      const testProjectId = projects[0].id;
      console.log(`4. Checking grades for project ID ${testProjectId}...`);
      const projectGrades = await db.query(
        'SELECT * FROM grades WHERE project_id = ?',
        [testProjectId]
      );
      console.log(`   Found ${projectGrades.length} grades for this project:`);
      projectGrades.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
      console.log('');
    }
    
    // Check books
    console.log('5. Checking books...');
    const books = await db.query('SELECT id, name, grade_id FROM books LIMIT 10');
    console.log(`   Found ${books.length} books:`);
    books.forEach(b => console.log(`   - ID: ${b.id}, Name: ${b.name}, Grade ID: ${b.grade_id}`));
    console.log('');
    
    // Check units
    console.log('6. Checking units...');
    const units = await db.query('SELECT id, name, book_id FROM units LIMIT 10');
    console.log(`   Found ${units.length} units:`);
    units.forEach(u => console.log(`   - ID: ${u.id}, Name: ${u.name}, Book ID: ${u.book_id}`));
    console.log('');
    
    // Check lessons
    console.log('7. Checking lessons...');
    const lessons = await db.query('SELECT id, name, unit_id FROM lessons LIMIT 10');
    console.log(`   Found ${lessons.length} lessons:`);
    lessons.forEach(l => console.log(`   - ID: ${l.id}, Name: ${l.name}, Unit ID: ${l.unit_id}`));
    console.log('');
    
    // Test the exact query from gradeController
    if (projects.length > 0) {
      const testProjectId = projects[0].id;
      console.log(`8. Testing exact controller query for project ${testProjectId}...`);
      const query = `
        SELECT g.*, 
               0 as book_count,
               0 as unit_count,
               0 as lesson_count
        FROM grades g
        WHERE g.project_id = ?
        ORDER BY g.order_index ASC, g.name ASC
      `;
      const result = await db.query(query, [testProjectId]);
      console.log(`   Query returned ${result.length} grades`);
      console.log(`   Raw result:`, JSON.stringify(result, null, 2));
      console.log('');
    }
    
    console.log('✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await db.close();
    process.exit(0);
  }
}

diagnoseGrades();
