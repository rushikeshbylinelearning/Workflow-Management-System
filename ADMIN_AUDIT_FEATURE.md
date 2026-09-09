# Admin Audit Management Feature

## Overview
This feature allows administrators to manage and revert performance flags and extension requests assigned to users. All deletions are tracked with comprehensive audit trailing including user information and timestamps in IST (Indian Standard Time).

## Features

### 1. Performance Flags Management
- **View all performance flags** with detailed information (team member, task, project, flag type, reason)
- **Filter flags** by team member ID, task ID, or flag type (red, orange, yellow, green)
- **Delete individual flags** or **bulk delete multiple flags**
- **Audit trail** for all flag deletions with:
  - Original flag information (type, reason, who added it, when)
  - Deletion information (who deleted it, when in IST)
  - IP address and user agent
  - Team member and task context

### 2. Extension Requests Management
- **View all extension requests** with detailed information (task, project, status, dates)
- **Filter requests** by status (pending, approved, rejected), task ID, or project ID
- **Delete individual requests** or **bulk delete multiple requests**
- **Audit trail** for all extension request deletions with:
  - Original request information (who requested, dates, reason, status)
  - Review information (who reviewed, when, review notes)
  - Deletion information (who deleted it, when in IST)
  - IP address and user agent

### 3. Audit Trail with IST Timestamps
All audit logs display timestamps in **Indian Standard Time (IST)** with proper formatting:
- Date format: `MMM DD, YYYY, HH:MM:SS AM/PM IST`
- Example: `Aug 24, 2026, 02:30:45 PM IST`

## Database Schema

### flag_audit_logs Table
```sql
CREATE TABLE flag_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  flag_id INT NOT NULL,
  team_member_id INT NOT NULL,
  team_member_name VARCHAR(255),
  task_id INT,
  task_name VARCHAR(255),
  flag_type ENUM('red', 'orange', 'yellow', 'green') NOT NULL,
  flag_reason TEXT NOT NULL,
  original_added_by VARCHAR(255),
  original_added_by_id INT,
  original_created_at TIMESTAMP NULL,
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_by_type ENUM('admin', 'team', 'system') DEFAULT 'admin',
  deleted_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  -- Indexes for performance
  INDEX idx_flag_id (flag_id),
  INDEX idx_team_member (team_member_id),
  INDEX idx_task (task_id),
  INDEX idx_deleted_by (deleted_by, deleted_by_type),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_flag_type (flag_type)
);
```

### extension_request_audit_logs Table
```sql
CREATE TABLE extension_request_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  extension_id INT NOT NULL,
  task_id INT NOT NULL,
  task_name VARCHAR(255),
  project_id INT,
  project_name VARCHAR(255),
  requested_by INT NOT NULL,
  requested_by_name VARCHAR(255),
  requested_by_type ENUM('admin', 'team') NOT NULL,
  current_due_date DATETIME,
  requested_due_date DATETIME,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL,
  reviewed_by INT,
  reviewed_by_name VARCHAR(255),
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_by_type ENUM('admin', 'team', 'system') DEFAULT 'admin',
  deleted_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  -- Indexes for performance
  INDEX idx_extension_id (extension_id),
  INDEX idx_task (task_id),
  INDEX idx_project (project_id),
  INDEX idx_requested_by (requested_by, requested_by_type),
  INDEX idx_deleted_by (deleted_by, deleted_by_type),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_status (status)
);
```

## API Endpoints

### Performance Flags

#### GET /api/admin-audit/flags
Get all performance flags with optional filters.

**Query Parameters:**
- `teamMemberId` (optional): Filter by team member ID
- `taskId` (optional): Filter by task ID
- `flagType` (optional): Filter by flag type (red, orange, yellow, green)
- `limit` (optional): Limit results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "team_member_id": 5,
      "team_member_name": "John Doe",
      "team_member_email": "john@example.com",
      "task_id": 10,
      "task_name": "Project Task",
      "project_name": "Example Project",
      "type": "red",
      "reason": "Missed deadline",
      "added_by_name": "Admin User",
      "created_at": "2026-08-20T10:30:00.000Z",
      "created_at_ist": "Aug 20, 2026, 04:00:00 PM IST"
    }
  ],
  "count": 1
}
```

#### DELETE /api/admin-audit/flags/:flagId
Delete a performance flag with audit logging.

**Response:**
```json
{
  "success": true,
  "message": "Performance flag deleted successfully",
  "audit": {
    "deleted_at_ist": "Aug 24, 2026, 02:30:45 PM IST",
    "deleted_by": "Admin User"
  }
}
```

#### POST /api/admin-audit/flags/bulk-delete
Bulk delete multiple performance flags.

**Request Body:**
```json
{
  "flagIds": [1, 2, 3, 4]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted 4 flags successfully",
  "summary": {
    "success": 4,
    "failed": 0
  },
  "audit": {
    "deleted_at_ist": "Aug 24, 2026, 02:30:45 PM IST",
    "deleted_by": "Admin User"
  }
}
```

#### GET /api/admin-audit/flags/audit-logs
Get flag deletion audit logs.

**Query Parameters:**
- `teamMemberId` (optional): Filter by team member ID
- `taskId` (optional): Filter by task ID
- `flagType` (optional): Filter by flag type
- `limit` (optional): Limit results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "flag_id": 10,
      "team_member_name": "John Doe",
      "task_name": "Project Task",
      "flag_type": "red",
      "flag_reason": "Missed deadline",
      "original_added_by": "Admin User",
      "deleted_by_name": "Super Admin",
      "deleted_at_ist": "Aug 24, 2026, 02:30:45 PM IST",
      "original_created_at_ist": "Aug 20, 2026, 04:00:00 PM IST"
    }
  ],
  "count": 1
}
```

### Extension Requests

#### GET /api/admin-audit/extensions
Get all extension requests with optional filters.

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)
- `taskId` (optional): Filter by task ID
- `projectId` (optional): Filter by project ID
- `limit` (optional): Limit results (default: 100)

#### DELETE /api/admin-audit/extensions/:extensionId
Delete an extension request with audit logging.

#### POST /api/admin-audit/extensions/bulk-delete
Bulk delete multiple extension requests.

**Request Body:**
```json
{
  "extensionIds": [1, 2, 3]
}
```

#### GET /api/admin-audit/extensions/audit-logs
Get extension request deletion audit logs.

## Frontend Usage

### Accessing the Feature
1. Navigate to the **Settings** page in the admin panel
2. Click on the **Audit Management** tab
3. Choose between **Performance Flags** or **Extension Requests**

### Performance Flags Tab
- View all assigned performance flags
- Filter by team member, task, or flag type
- Select individual flags or use "Select All"
- Click "Delete Selected" to bulk delete flags
- Toggle "Show Audit Logs" to view deletion history
- All deletions are logged with IST timestamps

### Extension Requests Tab
- View all extension requests (pending, approved, rejected)
- Filter by status, task, or project
- Select individual requests or use "Select All"
- Click "Delete Selected" to bulk delete requests
- Toggle "Show Audit Logs" to view deletion history
- All deletions are logged with IST timestamps

### Audit Logs Display
When "Show Audit Logs" is enabled, you'll see:
- **Original information**: Who created the flag/request, when (IST)
- **Deletion information**: Who deleted it, when (IST)
- **Context**: Team member, task, project names
- **Details**: Flag type, reason, status, etc.

## Security Features

1. **Admin-only access**: Only authenticated admin users can delete flags/requests
2. **Audit trailing**: Every deletion is logged with complete context
3. **IP tracking**: IP addresses are recorded for security auditing
4. **User agent tracking**: Browser/client information is logged
5. **Immutable audit logs**: Audit logs cannot be deleted or modified
6. **Timestamps in IST**: All timestamps displayed in Indian Standard Time

## Installation

1. **Run the migration**:
   ```bash
   node backend/migrate.js 03_add_flag_extension_audit.sql
   ```

2. **Verify tables were created**:
   ```sql
   SHOW TABLES LIKE '%audit%';
   -- Should show: flag_audit_logs, extension_request_audit_logs
   ```

3. **Restart the backend server**:
   ```bash
   npm run dev
   ```

4. **Access the feature**:
   - Navigate to Settings → Audit Management in the admin panel

## Maintenance

### Database Cleanup
Audit logs grow over time. Consider implementing a cleanup policy:

```sql
-- Example: Delete audit logs older than 1 year
DELETE FROM flag_audit_logs 
WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM extension_request_audit_logs 
WHERE deleted_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Monitoring
Monitor audit log growth:

```sql
-- Check audit log counts
SELECT 
  'flag_audit_logs' as table_name,
  COUNT(*) as record_count,
  MIN(deleted_at) as oldest_record,
  MAX(deleted_at) as newest_record
FROM flag_audit_logs
UNION ALL
SELECT 
  'extension_request_audit_logs',
  COUNT(*),
  MIN(deleted_at),
  MAX(deleted_at)
FROM extension_request_audit_logs;
```

## Troubleshooting

### Issue: Timestamps not showing in IST
**Solution**: The backend converts timestamps to IST automatically. Verify your server's timezone settings.

### Issue: Audit logs not appearing
**Solution**: 
1. Check if the audit tables exist: `SHOW TABLES LIKE '%audit%';`
2. Verify the migration was applied successfully
3. Check backend logs for errors

### Issue: Permission denied when deleting
**Solution**: Ensure the user is authenticated as an admin with proper JWT token.

## Future Enhancements

1. **Export audit logs**: Add ability to export audit logs to CSV/Excel
2. **Advanced filtering**: Add date range filters for audit logs
3. **Restore functionality**: Implement ability to restore deleted flags/requests
4. **Email notifications**: Send notifications when flags/requests are deleted
5. **Dashboard widget**: Add audit summary widget to admin dashboard

## Support

For issues or questions, please contact the development team or create a ticket in the project management system.
