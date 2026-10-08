# Performance Fix for Tag Filters

## Problem
The application is loading slowly and timing out when using tag filters (Grade, Book, Unit, Lesson) because the database lacks indexes on these columns.

## Solution
Add database indexes to the `tasks` table for hierarchy columns.

---

## Option 1: Using phpMyAdmin (Recommended for WAMP)

1. Open **phpMyAdmin** in your browser (usually http://localhost/phpmyadmin)
2. Select the **`workflow_db`** database from the left sidebar
3. Click on the **`tasks`** table
4. Click on the **"Structure"** tab
5. Scroll down and click **"Indexes"** or find the index section
6. Add the following indexes one by one:

   **Index 1:**
   - Index name: `idx_grade_id`
   - Column: `grade_id`
   - Type: INDEX
   
   **Index 2:**
   - Index name: `idx_book_id`
   - Column: `book_id`
   - Type: INDEX
   
   **Index 3:**
   - Index name: `idx_unit_id`
   - Column: `unit_id`
   - Type: INDEX
   
   **Index 4:**
   - Index name: `idx_lesson_id`
   - Column: `lesson_id`
   - Type: INDEX
   
   **Index 5 (Composite):**
   - Index name: `idx_hierarchy_composite`
   - Columns: `project_id`, `grade_id`, `book_id`, `unit_id`, `lesson_id`
   - Type: INDEX

---

## Option 2: Using SQL Queries (Faster)

1. Open **phpMyAdmin**
2. Select the **`workflow_db`** database
3. Click on the **"SQL"** tab at the top
4. Copy and paste this SQL and click **"Go"**:

```sql
-- Add indexes for hierarchy columns
CREATE INDEX idx_grade_id ON tasks(grade_id);
CREATE INDEX idx_book_id ON tasks(book_id);
CREATE INDEX idx_unit_id ON tasks(unit_id);
CREATE INDEX idx_lesson_id ON tasks(lesson_id);
CREATE INDEX idx_hierarchy_composite ON tasks(project_id, grade_id, book_id, unit_id, lesson_id);
```

If you get an error that indexes already exist, that's fine - they're already there.

---

## Option 3: Using MySQL Command Line

```bash
mysql -u root -p workflow_db < add_hierarchy_indexes_simple.sql
```

---

## Verification

After adding the indexes, verify they were created:

```sql
SHOW INDEX FROM tasks WHERE Key_name LIKE 'idx_%';
```

You should see the new indexes listed.

---

## Expected Results

After adding these indexes:
- ✅ Tag filter queries will be 10-100x faster
- ✅ No more timeout errors when filtering by hierarchy
- ✅ Export with tag filters will complete quickly
- ✅ Overall application performance will improve

---

## Alternative: If You Can't Access Database Directly

If you can't access phpMyAdmin or MySQL command line, you can:

1. Fix the `.env` file first (line 12 is missing a `#`)
2. Run the Node.js script:
   ```bash
   cd backend
   node add-hierarchy-indexes.js
   ```

But this requires the database connection to be working.
