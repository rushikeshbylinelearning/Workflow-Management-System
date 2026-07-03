# Quick Fix Guide - "Failed to Fetch Projects" Error

## TL;DR

Your `bylinelm_workflow_db` database is missing the `role` column and `team_member_permissions` table. This breaks authentication for ALL API calls, including projects.

## 🚀 Quick Fix (2 minutes)

### Step 1: Run the Fix Script
```bash
cd backend
node fix-bylinelm-db.js
```

### Step 2: Restart Backend
```bash
# Stop the current backend process
# Then restart it
npm start
# or
pm2 restart ecosystem.config.js
```

### Step 3: Test
Go to `hr.bylinelms.com` and try loading projects. The error should be gone.

---

## If You Prefer SQL

### Option A: Using MySQL Client
1. Open your MySQL client (phpMyAdmin, MySQL Workbench, etc.)
2. Select database: `bylinelm_workflow_db`
3. Open file: `backend/fix-bylinelm-schema.sql`
4. Copy and paste all SQL commands
5. Execute

### Option B: Using Command Line
```bash
mysql -h localhost -u bylinelm_workflow_db -p bylinelm_workflow_db < backend/fix-bylinelm-schema.sql
# Enter password: admin@Byline25
```

---

## ✅ Verify It Worked

```sql
-- Run these in your MySQL client to verify:

-- Check 1: role column exists
SHOW COLUMNS FROM team_members;
-- Look for: role | ENUM('employee','project_manager')

-- Check 2: permissions table exists
SHOW TABLES LIKE 'team_member_permissions';
-- Should return: team_member_permissions

-- Check 3: permissions data exists
SELECT COUNT(*) FROM team_member_permissions;
-- Should return a number > 0
```

---

## 🔍 What Was Wrong

| Item | bylinelm_workflow_db | legatolxp.online |
|------|----------------------|------------------|
| `role` column | ❌ Missing | ✅ Present |
| `team_member_permissions` table | ❌ Missing | ✅ Present |
| Projects fetch | ❌ Fails | ✅ Works |

---

## 📞 Still Having Issues?

1. **Check the logs:**
   ```bash
   tail -f backend/logs/error.log
   ```

2. **Verify database connection:**
   ```bash
   node backend/check-tables.js
   ```

3. **Check if backend is running:**
   ```bash
   curl http://localhost:3005/api/health
   ```

4. **Review full diagnosis:**
   See `BYLINELM_FETCH_ERROR_DIAGNOSIS.md` for detailed analysis

---

## 🎯 Expected Result

After the fix:
- ✅ Authentication middleware will pass
- ✅ Projects API will respond with data
- ✅ Frontend will load projects successfully
- ✅ No more "Failed to fetch projects" error
