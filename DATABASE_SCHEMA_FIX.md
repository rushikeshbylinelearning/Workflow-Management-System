# Database Schema Mismatch Fix

## Problem
The backend was throwing `ER_BAD_FIELD_ERROR: Unknown column 'full_name' in 'field list'` errors on all authenticated endpoints.

## Root Cause
The authentication middleware (`backend/middleware/auth.js`) was querying for columns that don't exist in the actual database schema:
- Querying for `full_name` but the column is named `name`
- Querying for `position` but the column is named `role`

### Actual team_members Table Schema
```
- id (int(11)) [PRIMARY KEY]
- email (varchar(255))
- passcode (varchar(20))
- name (varchar(255))           ← NOT full_name
- role (enum('employee','project_manager'))  ← NOT position
- is_active (tinyint(1))
- last_login_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

## Solution Applied
Updated three authentication middleware functions in `backend/middleware/auth.js`:

### 1. `requireTeamAuth` (Line 122)
**Before:**
```javascript
'SELECT id, email, full_name, position, is_active FROM team_members WHERE id = ? AND is_active = true'
```

**After:**
```javascript
'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true'
```

### 2. `requireAuth` (Line 243)
**Before:**
```javascript
'SELECT id, email, full_name, position, is_active FROM team_members WHERE id = ? AND is_active = true'
```

**After:**
```javascript
'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true'
```

### 3. `requireAdminOrPMAuth` (Line 380)
**Before:**
```javascript
'SELECT id, email, full_name, position, is_active FROM team_members WHERE id = ? AND is_active = true'
```

**After:**
```javascript
'SELECT id, email, name, role, is_active FROM team_members WHERE id = ? AND is_active = true'
```

Also updated the role assignment logic:
- Changed `teamMember.position` to `teamMember.role`
- Changed `teamMember.full_name` to `teamMember.name`

## Affected Endpoints
All endpoints that use team member authentication will now work:
- `/api/projects`
- `/api/team/my-tasks`
- `/api/team/my-performance-flags`
- `/api/tasks/team/notifications`
- `/api/access/my-permissions`
- And all other team member protected routes

## Testing
After restarting the backend server, all team member endpoints should return proper responses instead of 500 errors.

## Files Modified
- `backend/middleware/auth.js` - Fixed 3 authentication middleware functions
