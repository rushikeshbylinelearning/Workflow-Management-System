# Quick Reference Card

## 🚨 Problem
```
Failed to load performance flags: Error: Route not found
```

## 🎯 Cause
Missing files on hosted server:
- `backend/routes/adminAudit.js`
- `backend/controllers/adminAuditController.js`

## ✅ Solution (3 Steps)

### 1. Upload Files
```
Local → Server:
backend/routes/adminAudit.js → /server/backend/routes/
backend/controllers/adminAuditController.js → /server/backend/controllers/
```

### 2. Restart PM2
```bash
pm2 restart all
```

### 3. Verify
```bash
node backend/check-hosted-routes.js
```
Should show ✅ for `/api/admin-audit/flags`

---

## 📖 Documentation Index

| File | Purpose |
|------|---------|
| **FIX-SUMMARY.md** | 📋 Overview of the problem and fix |
| **URGENT-FIX-INSTRUCTIONS.md** | 🚀 Step-by-step fix instructions |
| **PROBLEM-DIAGRAM.md** | 📊 Visual diagrams of the issue |
| **DEPLOYMENT-CHECKLIST.md** | ✅ Future deployment guide |
| **backend/test-admin-audit-routes.js** | 🔍 Test local configuration |
| **backend/check-hosted-routes.js** | 🌐 Test hosted server |

---

## 🔧 Useful Commands

### Test Hosted Server (Run Locally)
```bash
cd backend
node check-hosted-routes.js
```

### Check Local Config
```bash
cd backend
node test-admin-audit-routes.js
```

### On Server (SSH)
```bash
# Check files exist
ls -la backend/routes/adminAudit.js
ls -la backend/controllers/adminAuditController.js

# PM2 commands
pm2 list                  # List all apps
pm2 restart all           # Restart all apps
pm2 logs                  # View logs
pm2 logs --err            # View errors only
pm2 logs --lines 50       # Last 50 lines

# Test endpoint locally on server
curl http://localhost:3005/api/admin-audit/flags
```

---

## ✅ Success Checklist

After applying the fix:
- [ ] `check-hosted-routes.js` shows ✅ for admin-audit
- [ ] No "Route not found" in browser console
- [ ] Admin Audit page loads performance flags
- [ ] PM2 status shows "online"
- [ ] PM2 logs show no errors

---

## 🆘 Troubleshooting

### Still getting 404?
1. Verify files were uploaded to correct location
2. Check file permissions: `chmod 644 *.js`
3. Try: `pm2 delete all && pm2 start ecosystem.config.js`
4. Check `server.js` has adminAudit registration

### PM2 shows "errored"?
```bash
pm2 logs --err --lines 100
```
Look for:
- Module not found errors
- Database connection errors
- Syntax errors

### Files uploaded but still not working?
1. Clear browser cache (Ctrl+Shift+Delete)
2. Check if `server.js` on server is up to date
3. Verify node_modules installed: `npm install`

---

## 📞 Get Help

If stuck, gather this info:
1. Output from: `node backend/check-hosted-routes.js`
2. PM2 logs: `pm2 logs --lines 100`
3. Screenshot of browser console error
4. Server file listing: `ls -la backend/routes/ backend/controllers/`

---

**Need detailed instructions?**  
👉 See [URGENT-FIX-INSTRUCTIONS.md](URGENT-FIX-INSTRUCTIONS.md)

**Want to understand the problem?**  
👉 See [PROBLEM-DIAGRAM.md](PROBLEM-DIAGRAM.md)
