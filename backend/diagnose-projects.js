const db = require('./db');

async function diagnoseProjects() {
  try {
    console.log('🔍 Diagnosing Projects Table...\n');

    // Test 1: Check if projects table exists
    console.log('Test 1: Checking if projects table exists...');
    try {
      const tableCheck = await db.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'projects'
      `);
      
      if (tableCheck.length > 0) {
        console.log('✅ Projects table EXISTS\n');
      } else {
        console.log('❌ Projects table DOES NOT EXIST\n');
        return;
      }
    } catch (error) {
      console.log('❌ Error checking table existence:', error.message, '\n');
      return;
    }

    // Test 2: Check table structure
    console.log('Test 2: Checking table structure...');
    try {
      const columns = await db.query(`
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('Columns in projects table:');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (Nullable: ${col.IS_NULLABLE}, Key: ${col.COLUMN_KEY || 'N/A'})`);
      });
      console.log();
    } catch (error) {
      console.log('❌ Error checking columns:', error.message, '\n');
      return;
    }

    // Test 3: Try simple SELECT query
    console.log('Test 3: Attempting simple SELECT query...');
    try {
      const result = await db.query('SELECT COUNT(*) as count FROM projects');
      console.log(`✅ Query successful. Total projects: ${result[0].count}\n`);
    } catch (error) {
      console.log('❌ Error executing SELECT:', error.message, '\n');
      return;
    }

    // Test 4: Try the actual getProjects query
    console.log('Test 4: Attempting actual getProjects query...');
    try {
      const query = `
        SELECT 
          p.*,
          c.name as category_name,
          c.description as category_description
        FROM projects p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
        ORDER BY p.created_at DESC
        LIMIT 10 OFFSET 0
      `;
      
      const result = await db.query(query);
      console.log(`✅ Query successful. Retrieved ${result.length} projects\n`);
      
      if (result.length > 0) {
        console.log('Sample project:');
        console.log(JSON.stringify(result[0], null, 2));
      }
    } catch (error) {
      console.log('❌ Error executing getProjects query:', error.message, '\n');
      return;
    }

    // Test 5: Check for any foreign key issues
    console.log('Test 5: Checking foreign key constraints...');
    try {
      const fks = await db.query(`
        SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (fks.length > 0) {
        console.log('Foreign keys:');
        fks.forEach(fk => {
          console.log(`  - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
        });
      } else {
        console.log('No foreign keys found');
      }
      console.log();
    } catch (error) {
      console.log('❌ Error checking foreign keys:', error.message, '\n');
    }

    console.log('✅ Diagnosis complete!');
    process.exit(0);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run diagnosis
diagnoseProjects();
