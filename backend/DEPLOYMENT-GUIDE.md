# Workflow Backend Deployment Guide (CPanel/Hosted Environment)

## Current Issue: Backend Server Not Running

The error "Request timed out" means the Node.js backend on port 3005 is not running or not accessible.

---

## Quick Fix Steps

### 1. SSH into Your Server
```bash
ssh legatolx@workflow.bylinelms.com
# Or use CPanel Terminal
```

### 2. Navigate to Backend Directory
```bash
cd /home/legatolx/public_html/backend
```

### 3. Check if Backend is Running
```bash
# Check with PM2
pm2 list

# Or check Node processes
ps aux | grep node

# Check if port 3005 is listening
netstat -tulpn | grep 3005
# or
lsof -i :3005
```

### 4. Start the Backend Server

#### Option A: Using PM2 (Recommended for Production)
```bash
# Make start script executable
chmod +x start-server.sh

# Run the startup script
./start-server.sh

# Or manually with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable auto-start on reboot
```

#### Option B: Direct Node (For Testing Only)
```bash
# Test if server starts
node server.js

# If it starts successfully, press Ctrl+C and use PM2 instead
```

### 5. Verify Backend is Running
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs workflow-backend --lines 50

# Test health endpoint
curl http://localhost:3005/api/health

# Test from outside
curl https://workflow.bylinelms.com/api/health
```

---

## Common Issues & Solutions

### Issue 1: "Cannot find module" errors
```bash
cd /home/legatolx/public_html/backend
npm install
```

### Issue 2: Database connection fails
Check `backend/.env` file:
- DB_HOST=localhost
- DB_NAME=legatolx_workflow_db
- DB_USER=legatolx_workflow_db
- DB_PASSWORD=admin@Byline25

Test database connection:
```bash
node test-db-connection.js
```

### Issue 3: Port 3005 already in use
```bash
# Find process using port 3005
lsof -i :3005

# Kill the process (replace PID with actual process ID)
kill -9 PID

# Or use PM2 to restart
pm2 restart workflow-backend
```

### Issue 4: Permission denied
```bash
# Fix file permissions
chmod +x start-server.sh
chmod -R 755 /home/legatolx/public_html/backend

# Fix ownership (if needed)
chown -R legatolx:legatolx /home/legatolx/public_html/backend
```

### Issue 5: PM2 not installed
```bash
# Install PM2 globally
npm install -g pm2

# If permission denied, use npx instead
npx pm2 start ecosystem.config.js
```

---

## Monitoring & Maintenance

### View Logs
```bash
# Real-time logs
pm2 logs workflow-backend

# Last 100 lines
pm2 logs workflow-backend --lines 100

# Error logs only
pm2 logs workflow-backend --err

# Output logs only
pm2 logs workflow-backend --out
```

### Restart Server
```bash
# Restart backend
pm2 restart workflow-backend

# Restart with zero downtime
pm2 reload workflow-backend

# Stop backend
pm2 stop workflow-backend

# Start backend
pm2 start workflow-backend
```

### Monitor Performance
```bash
# Real-time monitoring
pm2 monit

# Process info
pm2 info workflow-backend

# CPU and memory usage
pm2 list
```

---

## Auto-Start on Server Reboot

```bash
# Generate startup script
pm2 startup

# Follow the instructions (usually requires sudo)
# Example output:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u legatolx --hp /home/legatolx

# Save current PM2 process list
pm2 save

# Test by rebooting server
sudo reboot

# After reboot, check if backend is running
pm2 list
```

---

## Verify Deployment

### 1. Check Backend Health
```bash
curl http://localhost:3005/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-04-23T...",
  "database": "Connected",
  "uptime": 123.456,
  "environment": "production"
}
```

### 2. Check from Browser
Open: https://workflow.bylinelms.com/api/health

### 3. Check Frontend Connection
Open: https://workflow.bylinelms.com
- Login should work
- Projects should load
- Educational Hierarchy should load

---

## Troubleshooting Checklist

- [ ] Backend server is running (`pm2 list` shows "online")
- [ ] Port 3005 is listening (`netstat -tulpn | grep 3005`)
- [ ] Database connection works (`curl http://localhost:3005/api/health`)
- [ ] .htaccess proxy rule is configured
- [ ] Frontend can reach backend (`curl https://workflow.bylinelms.com/api/health`)
- [ ] No firewall blocking port 3005
- [ ] PM2 logs show no errors (`pm2 logs workflow-backend`)

---

## Emergency Recovery

If everything fails, try this complete reset:

```bash
# 1. Stop all Node processes
pm2 kill
pkill -9 node

# 2. Clean install
cd /home/legatolx/public_html/backend
rm -rf node_modules package-lock.json
npm install

# 3. Test database
node test-db-connection.js

# 4. Start fresh
pm2 start ecosystem.config.js
pm2 save

# 5. Check logs
pm2 logs workflow-backend --lines 50
```

---

## Contact & Support

If issues persist:
1. Check PM2 logs: `pm2 logs workflow-backend`
2. Check Apache error logs: `/var/log/apache2/error.log` or CPanel error logs
3. Check Node.js version: `node --version` (should be v14+ or v16+)
4. Check npm version: `npm --version`

---

## Files Modified in This Fix

1. `.htaccess` - Added proxy rule for /api requests
2. `backend/ecosystem.config.js` - PM2 configuration
3. `backend/start-server.sh` - Startup script
4. `backend/DEPLOYMENT-GUIDE.md` - This guide
