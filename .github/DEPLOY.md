# Staging + production CI/CD

Two environments:

| | Staging | Production |
|---|---|---|
| Host | Hostinger shared/cloud (empty today) | A2, already running with PM2 |
| Branch | `staging` (auto) or Actions → Run workflow | Actions → Run workflow → `production` |
| Database | New Hostinger MySQL | Existing live DB — never overwrite `.env` |
| Process | Hostinger Node.js app | `pm2` process `workflow-backend` |

GitHub Actions only reads workflow files from `.github/workflows/deploy.yml` (not a `deploy.yml` in the repo root).

---

## 0. Confirm Hostinger can run Node.js

This app is Express + MySQL, not PHP. On Hostinger it needs **Business** or **Cloud** (Node.js websites). A plain Single/Premium PHP-only plan cannot run the backend.

In hPanel check for one of:

- **Websites → Add website → Node.js web app**
- **Advanced → Node.js**

If neither exists, upgrade the plan before continuing.

---

## 1. Staging domain

In hPanel attach the URL you want for staging (a real domain, a subdomain, or Hostinger’s temporary URL).

Examples:

- `https://workflow-staging.yourdomain.com`
- `https://staging-xxxxx.hostingersite.com`

Use that exact origin everywhere below (`APP_URL`, `API_URL`, `CORS_ORIGIN`). Production stays `https://workflow.bylinelms.com`.

---

## 2. Enable SSH on Hostinger (needed for GitHub Actions)

1. hPanel → **Advanced → SSH Access**
2. Enable SSH
3. Copy:
   - **IP / hostname**
   - **Username** (often `u123456789`)
   - **Port** — shared/cloud is almost always **65002**, not 22
4. Note the website path. Hostinger usually uses:

```text
/home/u123456789/domains/YOUR-STAGING-DOMAIN/public_html
```

That folder is `DEPLOY_PATH`.

On Windows, generate a deploy key (do this once):

```powershell
ssh-keygen -t ed25519 -C "github-actions-staging" -f $env:USERPROFILE\.ssh\workflow_staging_deploy -N ""
```

Copy the **public** key into hPanel SSH Access (import/authorize). Keep the **private** key for GitHub. Never commit it.

Test from PowerShell:

```powershell
ssh -i $env:USERPROFILE\.ssh\workflow_staging_deploy -p 65002 u123456789@YOUR_SERVER_IP
```

---

## 3. Create a staging database (separate from live)

1. hPanel → **Databases → Management** (or MySQL Databases)
2. Create database, for example `u123456789_workflow_stg`
3. Create a user and a strong password
4. Grant that user **ALL** privileges on that database only
5. Host from the app server is `localhost`
6. Save the exact `DB_NAME`, `DB_USER`, `DB_PASSWORD`

Do **not** import the production dump unless you intentionally want a data copy. The first staging deploy can create an empty schema.

---

## 4. Create the Node.js application on the empty hosting

Files will land at `DEPLOY_PATH` like this:

```text
DEPLOY_PATH/
  index.html          (frontend)
  assets/
  dist/               (same frontend, served by Express)
  backend/
    server.js         (startup file)
    .env              (written from GitHub secret)
```

In hPanel Node.js / Node.js web app:

| Field | Value |
|---|---|
| Node.js version | 20 |
| Application root | `DEPLOY_PATH/backend` |
| Startup file | `server.js` |
| Application URL | your staging domain |
| Mode | production |

You can create the app **before** files exist; the first deploy fills the directory. After deploy, use **Restart / Rebuild** in hPanel if the GitHub health check fails.

---

## 5. Generate staging secrets (do not reuse production JWT keys)

On your laptop:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it three times: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`.

Open `deploy/staging.backend.env.example`, fill in:

- Hostinger DB name / user / password
- The three generated secrets
- `CORS_ORIGIN=https://YOUR-STAGING-DOMAIN`

That whole file becomes GitHub secret `BACKEND_ENV`.

---

## 6. Collect production (A2) SSH details — do not copy the live `.env` into GitHub

Production already has `/home/bylinelm/workflow.bylinelms.com` and PM2. GitHub only needs SSH so it can rsync code and run `pm2 reload`. The live `backend/.env` stays on the server.

From A2 cPanel or an existing SSH session, collect:

| Item | Where to find it |
|---|---|
| SSH host | Server IP, or `workflow.bylinelms.com` |
| SSH port | cPanel → SSH Access (often 22; A2 sometimes uses 7822) |
| SSH user | `bylinelm` (matches `/home/bylinelm/...`) |
| Deploy path | `/home/bylinelm/workflow.bylinelms.com` |
| PM2 name | `workflow-backend` |

Generate a **separate** production deploy key:

```powershell
ssh-keygen -t ed25519 -C "github-actions-production" -f $env:USERPROFILE\.ssh\workflow_prod_deploy -N ""
```

Import the public key in A2 cPanel → SSH Access → Manage SSH Keys → Authorize. Test:

```powershell
ssh -i $env:USERPROFILE\.ssh\workflow_prod_deploy -p 22 bylinelm@YOUR_A2_HOST
```

On the server, confirm:

```bash
pwd
pm2 list
ls /home/bylinelm/workflow.bylinelms.com/backend/.env
```

---

## 7. GitHub Environments and secrets

Repo: **Settings → Environments**

Create two environments: `staging` and `production`.

On **production**, optionally add a required reviewer so live cannot deploy without approval.

### `staging` environment — Variables

| Name | Example |
|---|---|
| `APP_URL` | `https://YOUR-STAGING-DOMAIN` |
| `API_URL` | `https://YOUR-STAGING-DOMAIN/api` |
| `SSO_DASHBOARD_URL` | leave empty, or your SSO dashboard |

### `staging` environment — Secrets

| Name | Value |
|---|---|
| `SSH_HOST` | Hostinger IP |
| `SSH_PORT` | `65002` |
| `SSH_USER` | `u123456789` |
| `SSH_KEY` | **private** key (`workflow_staging_deploy`) including `BEGIN` / `END` lines |
| `DEPLOY_PATH` | `/home/u123456789/domains/YOUR-STAGING-DOMAIN/public_html` |
| `BACKEND_ENV` | full contents of the filled staging `.env` |
| `PROCESS_MANAGER` | `passenger` (optional; omit to auto-detect) |

### `production` environment — Variables

| Name | Value |
|---|---|
| `APP_URL` | `https://workflow.bylinelms.com` |
| `API_URL` | `https://workflow.bylinelms.com/api` |
| `SSO_DASHBOARD_URL` | `https://sso.bylinelms.com/dashboard` |

### `production` environment — Secrets

| Name | Value |
|---|---|
| `SSH_HOST` | A2 host / IP |
| `SSH_PORT` | `22` or A2 SSH port |
| `SSH_USER` | `bylinelm` |
| `SSH_KEY` | production **private** key |
| `DEPLOY_PATH` | `/home/bylinelm/workflow.bylinelms.com` |
| `PROCESS_MANAGER` | `pm2` |
| `PM2_APP_NAME` | `workflow-backend` |

Do not add `BACKEND_ENV` on production. Live credentials stay on the A2 server.

Paste private keys with the header lines, for example:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

---

## 8. First staging deploy (empty server)

1. Commit and push this CI/CD work to `main`
2. Create the `staging` branch:

```powershell
git checkout -b staging
git push -u origin staging
```

3. GitHub → **Actions → Deploy → Run workflow**
   - target: `staging`
   - bootstrap_db: **true** (first time only)
4. Watch the job. Failures at “Require staging secrets” mean a GitHub value is missing.
5. If files uploaded but health check failed: hPanel → Node.js → **Restart**, then hit `https://YOUR-STAGING-DOMAIN/api/health`
6. Log in with `admin@workflow.com` / `admin123` and change that password immediately

Later staging deploys: leave `bootstrap_db` **false** (or just push to `staging`).

---

## 9. Production deploy (existing PM2 app)

After staging looks correct:

1. GitHub → **Actions → Deploy → Run workflow → production**
2. The job builds the frontend with the live API URL, rsyncs code, runs `npm ci` in `backend`, and `pm2 reload workflow-backend`
3. It does **not** replace `backend/.env`, `uploads/`, or the live database
4. Confirm `https://workflow.bylinelms.com/api/health` and a normal login

To auto-deploy production on every `main` push, uncomment `- main` under `on.push.branches` in `.github/workflows/deploy.yml`.

---

## 10. What to verify

Staging:

- `https://YOUR-STAGING-DOMAIN/api/health` → `"database": "Connected"`
- Frontend loads on the staging URL
- Login works against the **new** DB (empty projects)

Production:

- `pm2 list` still shows `workflow-backend` online
- `https://workflow.bylinelms.com/api/health`
- Existing users/data unchanged

---

## Troubleshooting

**SSH permission denied**  
Wrong key, key not authorized in the panel, or wrong port (Hostinger 65002 vs A2 22/7822).

**npm not found on Hostinger**  
The Node.js app exists in hPanel but CLI Node is not on PATH. Restart/Rebuild in the Node.js UI after rsync. You can also SSH and `source ~/nodevenv/.../bin/activate`.

**Health check 502 / timeout**  
Node app not mapped to the domain, or it is still using the empty folder. Confirm Application root = `DEPLOY_PATH/backend` and startup file = `server.js`.

**Database access denied**  
`DB_NAME` / `DB_USER` / `DB_PASSWORD` in `BACKEND_ENV` must match hPanel exactly, including the `u123_...` prefix.

**Frontend calls production API**  
`vars.API_URL` on the staging environment must be `https://YOUR-STAGING-DOMAIN/api` (rebuild required; it is baked in at `npm run build`).

**CORS errors**  
`CORS_ORIGIN` in `BACKEND_ENV` must be the staging origin with `https://` and no trailing slash.

**PM2 cwd errors on live**  
`ecosystem.config.js` now uses `__dirname`. After the first production deploy, `pm2 reload workflow-backend` is enough.
