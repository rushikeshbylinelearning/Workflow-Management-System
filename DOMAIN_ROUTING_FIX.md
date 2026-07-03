# Domain Routing Fix - workflow.bylinelms.com 503 Error

## Problem
- `workflow.legatolxp.online` - ✅ Working correctly
- `workflow.bylinelms.com` - ❌ Getting 503 Service Unavailable

Both domains point to the same codebase, but only one backend server is running.

## Root Cause
The `.htaccess` file was configured to proxy API requests to a local backend on port 3005:
```apache
RewriteRule ^api/(.*)$ http://127.0.0.1:3005/api/$1 [P,L,QSA]
```

However, the backend is only running on `workflow.legatolxp.online`, not on `workflow.bylinelms.com`.

## Solution Applied
Updated `.htaccess` to proxy all API requests from `workflow.bylinelms.com` to the working backend on `workflow.legatolxp.online`:

```apache
# Proxy API requests to Node.js backend running on legatolxp.online
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ https://workflow.legatolxp.online/api/$1 [P,L,QSA]
```

## How It Works Now

### User accesses workflow.bylinelms.com
1. Frontend loads from `workflow.bylinelms.com` (React SPA)
2. Frontend makes API call to `/api/auth/admin/login`
3. Apache `.htaccess` intercepts the request
4. Request is proxied to `https://workflow.legatolxp.online/api/auth/admin/login`
5. Backend on legatolxp.online processes the request
6. Response is returned to the frontend

### Result
- Both domains now work correctly
- Single backend server handles both domains
- No need to run two separate backend instances

## Testing

### Test the login endpoint:
```bash
curl -X POST https://workflow.bylinelms.com/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Should return a proper response (not 503).

### Test the health endpoint:
```bash
curl https://workflow.bylinelms.com/api/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "2026-05-15T...",
  "database": "Connected",
  "environment": "production"
}
```

## Files Modified
- `.htaccess` - Updated proxy rule to point to legatolxp.online backend

## Notes
- The proxy uses HTTPS for security
- All API requests are transparently forwarded
- The frontend still loads from the requested domain
- CORS headers are handled by the backend on legatolxp.online
- No changes needed to backend code or database configuration

## If You Want to Run Separate Backends

If in the future you want to run separate backend instances for each domain:

1. Start a backend server on `workflow.bylinelms.com` port 3005
2. Update `.htaccess` back to:
   ```apache
   RewriteRule ^api/(.*)$ http://127.0.0.1:3005/api/$1 [P,L,QSA]
   ```
3. Ensure both backends have access to the same database or separate databases as needed
