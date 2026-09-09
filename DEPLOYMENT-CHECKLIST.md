# Deployment Checklist for Hosted Server

Use this checklist whenever you deploy updates to ensure all files are synced and the server is properly restarted.

## Pre-Deployment

- [ ] All code changes committed and tested locally
- [ ] Database migrations (if any) tested and documented
- [ ] Environment variables checked in `.env` files
- [ ] Dependencies updated in `package.json`
- [ ] No console errors in local testing

## Files to Deploy

### Backend Files (Critical)
- [ ] `backend/server.js` - Main server file
- [ ] `backend/routes/*.js` - All route files
  - [ ] `backend/routes/adminAudit.js` ⚠️ Required for admin audit features
  - [ ] `backend/routes/performanceFlags.js`
  - [ ] Other route files as needed
- [ ] `backend/controllers/*.js` - All controller files
  - [ ] `backend/controllers/adminAuditController.js` ⚠️ Required
  - [ ] `backend/controllers/performanceFlagController.js`
- [ ] `backend/middleware/*.js` - Auth and error handling
- [ ] `backend/.env` - Environment configuration
- [ ] `backend/package.json` - Dependencies

### Frontend Files
- [ ] Build the frontend: `npm run build` in root directory
- [ ] Upload entire `dist/` folder to server
- [ ] Verify `dist/index.html` exists

### Database
- [ ] Run any pending migrations
- [ ] Backup database before major changes
- [ ] Verify tables exist (performance_flags, admin_users, etc.)

## Deployment Steps

### 1. Upload Files to Server
```bash
# Using SCP (replace paths as needed)
scp -r backend/* username@workflow.bylinelms.com:/path/to/app/backend/

# Or using FTP/SFTP client (FileZilla, WinSCP, etc.)
# Connect to server and upload files
```

### 2. Install Dependencies (if package.json changed)
```bash
ssh username@workflow.bylinelms.com
cd /path/to/app/backend
npm install
```

### 3. Restart Backend Server
```bash
# Using PM2
pm2 restart all

# Or restart specific app
pm2 restart workflow-backend

# Verify it's running
pm2 list
pm2 status
```

### 4. Check Logs for Errors
```bash
# View live logs
pm2 logs

# View error logs only
pm2 logs --err

# View last 50 lines
pm2 logs --lines 50
```

### 5. Test Endpoints
```bash
# Health check
curl https://workflow.bylinelms.com/api/health

# Admin audit endpoint
curl https://workflow.bylinelms.com/api/admin-audit/flags \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return data, not "Route not found"
```

## Post-Deployment Verification

- [ ] Website loads without errors
- [ ] Check browser console (F12) for JavaScript errors
- [ ] Login works (both admin and team member)
- [ ] Performance flags page loads data
- [ ] Can create/edit/delete performance flags
- [ ] No "Route not found" errors in console
- [ ] PM2 shows app as "online" status
- [ ] Database connection working

## Common Issues & Fixes

### Issue: "Route not found" Error
**Fix**: 
```bash
# Check if route files exist on server
ls -la backend/routes/adminAudit.js
ls -la backend/controllers/adminAuditController.js

# If missing, re-upload them
# Then restart PM2
pm2 restart all
```

### Issue: PM2 Shows "Errored" Status
**Fix**:
```bash
# View detailed error
pm2 logs --err --lines 100

# Common fixes:
# 1. Check .env file exists and has correct values
# 2. Check node_modules installed: npm install
# 3. Check database connection in .env
# 4. Restart: pm2 restart all
```

### Issue: Frontend Shows Old Version
**Fix**:
```bash
# Clear browser cache
# Or hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Also check .htaccess caching rules
# Add/update in .htaccess:
<IfModule mod_headers.c>
  <FilesMatch "\.(html|htm)$">
    Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
  </FilesMatch>
</IfModule>
```

### Issue: 503 Service Unavailable
**Fix**:
```bash
# Check if PM2 is running
pm2 list

# If not running, start it
pm2 start ecosystem.config.js

# Check logs
pm2 logs
```

### Issue: Database Connection Failed
**Fix**:
```bash
# Verify .env database settings
cat backend/.env | grep DB_

# Test database connection
cd backend
node -e "const db = require('./db'); db.testConnection().then(console.log)"

# Should print "true" if connected
```

## Rollback Plan

If deployment fails:

1. **Keep previous version backup**:
   ```bash
   # Before deploying, backup current version
   cp -r backend backend.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Restore from backup if needed**:
   ```bash
   # Stop current version
   pm2 stop all
   
   # Restore backup
   rm -rf backend
   cp -r backend.backup.YYYYMMDD_HHMMSS backend
   
   # Restart
   pm2 restart all
   ```

3. **Database rollback** (if migrations were run):
   ```bash
   # Run rollback migration
   node backend/rollback-helper.js
   ```

## Quick Commands Reference

```bash
# SSH to server
ssh username@workflow.bylinelms.com

# Navigate to app
cd /path/to/workflow.bylinelms.com

# PM2 commands
pm2 list                    # List all apps
pm2 restart all            # Restart all
pm2 logs                   # View logs
pm2 logs --err             # View errors only
pm2 stop all               # Stop all apps
pm2 start ecosystem.config.js  # Start from config

# Check running processes
pm2 status
pm2 describe workflow-backend

# Monitor in real-time
pm2 monit
```

## Notes

- Always test locally before deploying to production
- Keep a backup before major changes
- Document any manual steps required
- Update this checklist as deployment process evolves
- Consider setting up automated deployment (CI/CD) for future

## Emergency Contacts

- Hosting Provider Support: [Add contact info]
- Database Admin: [Add contact info]
- On-call Developer: [Add contact info]
