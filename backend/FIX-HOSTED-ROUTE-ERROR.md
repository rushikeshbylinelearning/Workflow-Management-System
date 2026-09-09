# Fix: "Route not found" Error for Performance Flags

## Problem
Getting `Failed to load performance flags: Error: Route not found` on the hosted server at workflow.bylinelms.com.

## Root Cause
The hosted server doesn't have the `/api/admin-audit/flags` endpoint because it's running outdated code.

## Verification (Local)
✅ All routes are properly configured locally:
- `backend/controllers/adminAuditController.js` exists with `getAllPerformanceFlags` function
- `backend/routes/adminAudit.js` exists with GET `/flags` route
- `backend/server.js` properly mounts routes at `/api/admin-audit`

## Solution Steps

### Step 1: Check What's Running on the Server
SSH into your hosted server and run:
```bash
# Connect to server (replace with your actual server details)
ssh username@workflow.bylinelms.com

# Navigate to your app directory
cd /path/to/workflow.bylinelms.com/backend

# Check if admin audit files exist
ls -la routes/adminAudit.js
ls -la controllers/adminAuditController.js

# Check what PM2 is running
pm2 list
pm2 logs --lines 50
```

### Step 2: Deploy Updated Code
If the files are missing or outdated, deploy your latest code:

```bash
# Option A: Using git (if you have git on server)
git pull origin main
npm install  # Install any new dependencies

# Option B: Upload files manually via FTP/SFTP
# Upload these files to the server:
# - backend/routes/adminAudit.js
# - backend/controllers/adminAuditController.js
# - backend/server.js (if updated)
```

### Step 3: Restart PM2
After deploying code, restart the backend:

```bash
# Restart all PM2 processes
pm2 restart all

# Or restart specific app (check name with 'pm2 list')
pm2 restart workflow-backend

# View logs to ensure restart was successful
pm2 logs --lines 100

# Check for errors
pm2 logs --err
```

### Step 4: Verify Routes Are Working
Test the endpoint directly:

```bash
# From your local machine, test the endpoint
curl -X GET https://workflow.bylinelms.com/api/admin-audit/flags \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"

# Should return list of performance flags, not "Route not found"
```

### Step 5: Clear Browser Cache
After server restart, clear your browser cache:
- Chrome: Ctrl+Shift+Delete → Clear cache
- Or hard refresh: Ctrl+Shift+R

## Quick Fix Script for Server

Save this as `quick-fix-routes.sh` and run on the server:

```bash
#!/bin/bash
echo "🔧 Fixing admin audit routes..."

# Navigate to backend directory
cd /path/to/workflow.bylinelms.com/backend

# Check if files exist
echo "📁 Checking files..."
if [ -f "routes/adminAudit.js" ]; then
    echo "✅ routes/adminAudit.js exists"
else
    echo "❌ routes/adminAudit.js MISSING!"
fi

if [ -f "controllers/adminAuditController.js" ]; then
    echo "✅ controllers/adminAuditController.js exists"
else
    echo "❌ controllers/adminAuditController.js MISSING!"
fi

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart all

# Show status
echo "📊 PM2 Status:"
pm2 list

# Show recent logs
echo "📋 Recent Logs:"
pm2 logs --lines 20 --nostream

echo "✅ Done! Check if the error is resolved."
```

Make it executable and run:
```bash
chmod +x quick-fix-routes.sh
./quick-fix-routes.sh
```

## Alternative: Temporary Workaround (Frontend)

If you can't immediately fix the server, you can modify the frontend to gracefully handle the missing endpoint:

In `src/components/AdminAuditManagement.tsx`, the code already handles errors gracefully:

```typescript
} catch (error: any) {
  console.error('Failed to load performance flags:', error);
  // Don't show error toast if it's just an empty result
  if (error?.message && !error.message.includes('not found')) {
    showToast('Failed to load performance flags', 'error');
  }
  setPerformanceFlags([]);
}
```

This means the UI should degrade gracefully, but the feature won't work until the server is fixed.

## Verify Fix

After implementing the fix, verify:

1. ✅ No console errors about "Route not found"
2. ✅ Performance flags load in Admin Audit page
3. ✅ Can add/delete performance flags
4. ✅ PM2 logs show no route errors

## Need More Help?

Run the diagnostic script:
```bash
cd backend
node test-admin-audit-routes.js
```

This will show you exactly what's configured and what's missing.
