# 🚨 URGENT FIX: Admin Audit Routes Missing on Server

## Problem Confirmed ✅
Your hosted server at `workflow.bylinelms.com` is missing the admin audit routes.

**Test Results:**
- ✅ Server is running
- ✅ Database connected  
- ✅ Other routes work
- ❌ `/api/admin-audit/flags` returns **404 Route Not Found**

## Root Cause
The following files are NOT on your hosted server:
- `backend/routes/adminAudit.js`
- `backend/controllers/adminAuditController.js`

## Quick Fix (Choose One Method)

### Method 1: SSH Access (Fastest)

If you have SSH access to your server:

```bash
# 1. Connect to server
ssh username@workflow.bylinelms.com

# 2. Navigate to backend directory
cd /home/username/public_html/workflow.bylinelms.com/backend
# OR wherever your backend is located

# 3. Check if files exist
ls -la routes/adminAudit.js
ls -la controllers/adminAuditController.js

# If missing, you need to upload them (see Method 2)

# 4. After uploading, restart PM2
pm2 restart all

# 5. Verify
pm2 logs
curl http://localhost:3005/api/admin-audit/flags
```

### Method 2: Upload via FTP/cPanel (Most Common)

1. **Connect to your server** using FTP client (FileZilla, WinSCP) or cPanel File Manager

2. **Navigate to your backend folder**:
   ```
   /home/username/public_html/workflow.bylinelms.com/backend/
   ```

3. **Upload these files** (from your local computer):
   - Upload `backend/routes/adminAudit.js` 
     → to `backend/routes/` folder on server
   - Upload `backend/controllers/adminAuditController.js` 
     → to `backend/controllers/` folder on server

4. **Restart the backend server**:
   - If using cPanel: Terminal → `pm2 restart all`
   - Or contact hosting support to restart Node.js application

5. **Test the fix**:
   - Open https://workflow.bylinelms.com in browser
   - Clear cache (Ctrl+Shift+Delete)
   - Go to Admin Audit page
   - Should now load without "Route not found" error

### Method 3: Using cPanel File Manager

1. Login to cPanel
2. Go to **File Manager**
3. Navigate to: `/public_html/workflow.bylinelms.com/backend/`
4. **Upload files**:
   - Go into `routes/` folder
   - Click **Upload** → select `adminAudit.js` from your local `backend/routes/` folder
   - Go back, then into `controllers/` folder  
   - Click **Upload** → select `adminAuditController.js` from your local `backend/controllers/` folder
5. **Restart application**:
   - In cPanel, open **Terminal**
   - Run: `pm2 restart all`
   - Or: `pm2 restart workflow-backend` (if that's the app name)
6. Check if error is gone

## Verify the Fix

After deploying and restarting:

1. **Test from command line** (on your local computer):
   ```bash
   node backend/check-hosted-routes.js
   ```
   Should show ✅ for `/api/admin-audit/flags` instead of ❌

2. **Test in browser**:
   - Open browser console (F12)
   - Go to Admin Audit Management page
   - Should NOT see "Failed to load performance flags: Error: Route not found"
   - Performance flags should load

3. **Check PM2 logs** (if you have SSH):
   ```bash
   pm2 logs --lines 50
   ```
   Should NOT show "Route not found" errors

## Files to Upload

Location on your local computer:
```
d:\Zip 4\workflow.bylinelms.com\backend\routes\adminAudit.js
d:\Zip 4\workflow.bylinelms.com\backend\controllers\adminAuditController.js
```

Upload to server at:
```
/your-server-path/backend/routes/adminAudit.js
/your-server-path/backend/controllers/adminAuditController.js
```

## Still Not Working?

If the error persists after uploading files and restarting:

1. **Check file permissions**:
   ```bash
   chmod 644 backend/routes/adminAudit.js
   chmod 644 backend/controllers/adminAuditController.js
   ```

2. **Check if server.js is up to date**:
   - Verify `server.js` on the server has these lines:
     ```javascript
     const adminAuditRoutes = require('./routes/adminAudit');
     app.use('/api/admin-audit', adminAuditRoutes);
     ```
   - If missing, upload your local `server.js` as well

3. **Check PM2 is actually restarting**:
   ```bash
   pm2 list           # Check status
   pm2 delete all     # Stop everything
   pm2 start ecosystem.config.js  # Start fresh
   ```

4. **Check for JavaScript errors on server**:
   ```bash
   pm2 logs --err --lines 100
   ```

## Need Help?

If you're stuck:
1. Take screenshots of any error messages
2. Run: `node backend/check-hosted-routes.js` and share output
3. Share PM2 logs: `pm2 logs --lines 50`
4. Contact hosting support and tell them you need to restart your Node.js app

## Prevention

To avoid this in the future:
- Always upload ALL changed files when deploying
- Use git on the server and pull changes
- Consider automated deployment (CI/CD)
- Keep a deployment checklist (see DEPLOYMENT-CHECKLIST.md)
