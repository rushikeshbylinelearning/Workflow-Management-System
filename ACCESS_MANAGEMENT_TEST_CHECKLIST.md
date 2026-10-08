# Access Management Testing Checklist

## Pre-Test Setup
- [ ] Ensure you have admin credentials
- [ ] Create 2-3 test team members
- [ ] Create 2-3 test teams
- [ ] Assign some tasks to different teams
- [ ] Have a test environment or backup before testing

## Admin Side Tests

### Access Management UI
- [ ] Navigate to Settings → Access Management
- [ ] Verify all team members are listed
- [ ] Verify teams list loads without errors
- [ ] Check that role dropdown shows Employee/Project Manager
- [ ] Verify access level badges show Read only (amber) or Read & write (green)
- [ ] Verify team access shows "All teams", "X teams", or "Own tasks"

### Permission Updates
- [ ] Change a user's role from Employee to Project Manager
- [ ] Verify permissions reset to PM defaults
- [ ] Toggle write_access between Read only and Read & write
- [ ] Verify badge updates immediately
- [ ] Check "All teams" checkbox
- [ ] Verify individual team checkboxes disable when "All teams" is checked
- [ ] Uncheck "All teams" and select 2 specific teams
- [ ] Verify selection saves (no errors in browser console)
- [ ] Toggle individual feature permissions (Dashboard, Projects, etc.)
- [ ] Open browser developer tools → Network tab
- [ ] Verify PUT requests to /api/access/members/:id/permissions succeed

### API Endpoint Tests
```bash
# Test 1: Get permission definitions (admin token required)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/access/permissions-definitions

# Expected: List of permission objects with key, label, description, category

# Test 2: Get teams list (admin token required)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/access/teams

# Expected: Array of teams with id, name, description, is_active

# Test 3: Get members with permissions (admin token required)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/access/members

# Expected: Array of team members with permissions, access_level, access_team_ids
```

## Team Member Side Tests

### Test User A: Read-Only with Own Tasks Only
**Admin Setup:**
- Role: Employee
- Access Level: Read only
- Team Access: None (uncheck "All teams", select no teams)
- Features: Enable "View All Tasks" only

**Team Member Tests:**
- [ ] Login as Test User A
- [ ] Verify sidebar shows only "My Tasks" and "All Tasks"
- [ ] Navigate to "All Tasks"
- [ ] Verify ONLY tasks assigned to this user are visible
- [ ] Verify no "Create Task" button visible
- [ ] Click on a task to view details
- [ ] Try to edit any field → Should see read-only behavior or error
- [ ] Check browser console for any errors
- [ ] Test GET /api/access/my-permissions endpoint:
```bash
curl -H "Authorization: Bearer TEAM_MEMBER_TOKEN" \
  http://localhost:5000/api/access/my-permissions

# Expected: 
# {
#   "success": true,
#   "data": {
#     "write_access": false,
#     "all_teams_access": false,
#     "access_team_ids": [],
#     "permissions": { ... }
#   }
# }
```

### Test User B: Read-Only with Specific Teams
**Admin Setup:**
- Role: Employee  
- Access Level: Read only
- Team Access: Select 2 specific teams (e.g., "Design", "Development")
- Features: Enable "View All Tasks"

**Team Member Tests:**
- [ ] Login as Test User B
- [ ] Navigate to "All Tasks"
- [ ] Verify can see:
  - [ ] Own assigned tasks
  - [ ] Tasks assigned to members of Design team
  - [ ] Tasks assigned to members of Development team
- [ ] Verify CANNOT see:
  - [ ] Tasks from other teams not in the selection
- [ ] Filter by team dropdown
- [ ] Verify only accessible teams appear in filter
- [ ] Try to create a task → Should not see create button or get error
- [ ] Try to edit a task → Should see error message
- [ ] Check permissions endpoint shows correct access_team_ids

### Test User C: Full Write Access with Specific Teams
**Admin Setup:**
- Role: Employee
- Access Level: Full read & write
- Team Access: Select 2 teams
- Features: Enable "View All Tasks", "View Projects", "View Dashboard"

**Team Member Tests:**
- [ ] Login as Test User C
- [ ] Verify sidebar shows: My Tasks, Dashboard, Projects, All Tasks
- [ ] Navigate to "All Tasks"
- [ ] Verify can see tasks from selected teams
- [ ] Verify "Create Task" button IS visible
- [ ] Create a new task:
  - [ ] Fill in task details
  - [ ] Assign to a member of an accessible team
  - [ ] Submit → Should succeed
- [ ] Edit an existing task:
  - [ ] Change task name
  - [ ] Update status
  - [ ] Update progress
  - [ ] Save → Should succeed without errors
- [ ] Try bulk operations:
  - [ ] Select multiple tasks
  - [ ] Try bulk status update → Should work
  - [ ] Try bulk delete → Should work
- [ ] Navigate to Dashboard → Should load without errors
- [ ] Navigate to Projects → Should load without errors

### Test User D: Project Manager with All Teams Access
**Admin Setup:**
- Role: Project Manager
- Access Level: Full read & write (default)
- Team Access: Check "All teams"
- Features: All enabled (default for PM)

**Team Member Tests:**
- [ ] Login as Test User D (PM)
- [ ] Verify sidebar shows all sections:
  - [ ] My Tasks
  - [ ] Dashboard
  - [ ] Projects
  - [ ] All Tasks
  - [ ] Teams
  - [ ] Allocations
  - [ ] Top Performers
  - [ ] Analytics
- [ ] Navigate to "All Tasks"
- [ ] Verify can see ALL tasks from ALL teams (same as admin)
- [ ] Verify all write actions available:
  - [ ] Create task
  - [ ] Edit task
  - [ ] Delete task
  - [ ] Bulk operations
- [ ] Navigate to Teams → Should see team management
- [ ] Navigate to Analytics → Should see analytics dashboard
- [ ] Create and assign tasks to any team member
- [ ] Verify no permission errors in console

## Edge Cases & Error Scenarios

### Permission Revocation
- [ ] User is logged in with full access
- [ ] Admin removes write_access
- [ ] User refreshes page
- [ ] Verify write buttons disappear
- [ ] Verify write actions return 403 errors

### Team Access Removal
- [ ] User has access to specific teams
- [ ] Admin removes all team access
- [ ] User refreshes page
- [ ] Navigate to "All Tasks"
- [ ] Verify only sees own assigned tasks

### Permission Loading Failure
- [ ] Simulate network error or database issue
- [ ] User tries to access /api/access/my-permissions
- [ ] Verify fallback to role-based defaults
- [ ] Verify user can still login and see My Tasks

### Invalid Token
- [ ] Use expired or invalid JWT token
- [ ] Try to access protected endpoints
- [ ] Verify returns 401 Unauthorized error

### SQL Injection Protection
- [ ] Try injecting SQL in team_id parameter
- [ ] Try injecting SQL in task filters
- [ ] Verify no SQL errors, queries are parameterized

## Database Verification

### Check Permissions Stored Correctly
```sql
-- View all permissions for a user
SELECT * FROM team_member_permissions 
WHERE team_member_id = YOUR_TEST_USER_ID;

-- Should see rows for each permission with is_granted 0 or 1
```

### Check Team Access Stored Correctly
```sql
-- View team access for a user
SELECT tmat.*, t.name as team_name
FROM team_member_access_teams tmat
JOIN teams t ON tmat.team_id = t.id
WHERE tmat.team_member_id = YOUR_TEST_USER_ID;

-- Should see one row per accessible team
```

### Verify Task Filtering Query
```sql
-- Test the actual query used for team-based filtering
-- Replace ? with actual user_id and team_ids

SELECT t.* FROM tasks t
WHERE (
  EXISTS (
    SELECT 1 FROM task_assignees ta_own
    WHERE ta_own.task_id = t.id
      AND ta_own.assignee_id = 123  -- user_id
      AND ta_own.assignee_type = 'team'
  )
  OR EXISTS (
    SELECT 1 FROM task_assignees ta_team
    INNER JOIN team_members_teams tmt
      ON ta_team.assignee_id = tmt.team_member_id
     AND ta_team.assignee_type = 'team'
     AND tmt.is_active = 1
    WHERE ta_team.task_id = t.id
      AND tmt.team_id IN (1, 2, 3)  -- team_ids
  )
);
```

## Performance Tests

- [ ] Load /api/access/members with 50+ team members
- [ ] Verify loads in < 2 seconds
- [ ] Load /api/tasks with team filtering for user with 10 teams
- [ ] Verify query executes in < 1 second
- [ ] Check database query explain plans for N+1 issues

## Security Audit

- [ ] Verify all admin endpoints require admin auth
- [ ] Verify team endpoints require team auth
- [ ] Verify write operations check write_access
- [ ] Verify team filtering applied to all task queries
- [ ] Verify no permission bypass via API parameter manipulation
- [ ] Check for XSS in team names or permission labels
- [ ] Verify CSRF protection on permission update endpoints

## Final Checklist

- [ ] All admin tests passing
- [ ] All team member tests passing
- [ ] All edge cases handled gracefully
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Database has correct permission records
- [ ] API endpoints return correct status codes
- [ ] Frontend updates UI based on permissions
- [ ] Documentation is clear and accurate
- [ ] Test results documented

## Test Result Summary

**Date Tested:** _______________
**Tested By:** _______________
**Environment:** _______________

**Results:**
- Admin Side: ☐ Pass ☐ Fail
- Read-Only Tests: ☐ Pass ☐ Fail  
- Write Access Tests: ☐ Pass ☐ Fail
- Team Filtering: ☐ Pass ☐ Fail
- Edge Cases: ☐ Pass ☐ Fail
- Security: ☐ Pass ☐ Fail

**Issues Found:**
1. 
2. 
3. 

**Notes:**


**Sign-off:** _______________

---

## Quick Command Reference

### Start the Application
```bash
# Backend
cd backend
npm install
npm start

# Frontend  
cd ..
npm install
npm run dev
```

### Check Logs
```bash
# Backend logs
tail -f backend/logs/app.log

# Or check console output
```

### Database Check
```bash
# Connect to database
mysql -u root -p workflow_db

# Check permissions
SELECT tm.name, tmp.permission_key, tmp.is_granted 
FROM team_members tm
LEFT JOIN team_member_permissions tmp ON tm.id = tmp.team_member_id
WHERE tm.email = 'test@example.com';

# Check team access
SELECT tm.name, t.name as team_name
FROM team_members tm
LEFT JOIN team_member_access_teams tmat ON tm.id = tmat.team_member_id
LEFT JOIN teams t ON tmat.team_id = t.id
WHERE tm.email = 'test@example.com';
```
