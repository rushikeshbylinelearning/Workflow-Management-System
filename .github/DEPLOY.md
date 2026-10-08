# Staging + production CI/CD

Two environments:

| | Staging | Production |
|---|---|---|
| Host | Hostinger **VPS** (empty today) | A2, already running with PM2 |
| Branch | `staging` (auto) or Actions → Run workflow | Actions → Run workflow → `production` |
| Database | New MySQL/MariaDB **on the VPS** | Existing A2 phpMyAdmin MySQL — never overwritten |
| Process | PM2 on the VPS (same idea as live) | `pm2` process `workflow-backend` |

GitHub Actions only reads workflow files from `.github/workflows/` (not a workflow file in the repo root).

| Workflow | When it runs | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | Pull requests, and pushes to `staging`, `main`, `production` | `npm ci` for frontend and backend, then `npm run build`. Fails the check if the app does not build. |
| `.github/workflows/deploy.yml` | Push to `staging`, or Actions → Run workflow | Builds again with that environment's `API_URL`, rsyncs over SSH, restarts PM2, hits `/api/health`. |

Require the **CI** check in branch protection before merging. Deploy does not replace that check: a push to `staging` still builds inside the deploy job, and a failed build never reaches the server.

---

## Databases: A2 phpMyAdmin vs Hostinger VPS

The app does **not** share one database. Each environment reads only its own `backend/.env`.

```text
Live users  →  A2 MySQL (phpMyAdmin)     →  bylinelm_workflow_db
Staging     →  Hostinger VPS MySQL       →  workflow_staging
Laptop      →  local WAMP                →  workflow_db
```

phpMyAdmin is only a **browser UI** on A2. The Node app talks MySQL on port 3306. The VPS is the same protocol. You can install phpMyAdmin on the VPS later for a familiar UI; it is optional.

| | A2 (live) | Hostinger VPS (staging) |
|---|---|---|
| Engine | MySQL/MariaDB behind cPanel | You install MySQL or MariaDB yourself |
| Admin UI | phpMyAdmin already there | `mysql` CLI first; phpMyAdmin optional |
| `DB_HOST` | `localhost` on the A2 box | `127.0.0.1` on the VPS |
| Name/user | cPanel prefix, e.g. `bylinelm_workflow_db` | names you choose, e.g. `workflow_staging` |
| Data | real projects, users, tasks | empty until you bootstrap or import a dump |
| CI/CD | never writes `.env`, never runs bootstrap | first deploy can create tables (`bootstrap_db`) |

**What this does *not* do**

- Staging deploys never connect to A2.
- Production deploys never connect to the VPS.
- Editing rows in Hostinger cannot change live data.
- Schema changes must be applied **twice** (staging first, live when you promote).

**Recommended:** keep staging empty (bootstrap schema only). Only dump A2 → VPS if you need a realistic data copy, and never point staging `DB_HOST` at the A2 server.

---

## 0. Hostinger VPS prerequisites

SSH into the VPS as root (or a sudo user). Install Node 20, PM2, nginx (or Apache), and MySQL/MariaDB. Staging uses the same PM2 pattern as A2.

Point the staging DNS A record at the VPS IP. Use that exact origin for `APP_URL`, `API_URL`, and `CORS_ORIGIN`. Production stays `https://workflow.bylinelms.com`.

Suggested layout:

```text
/var/www/workflow-staging/          ← DEPLOY_PATH
  index.html
  assets/
  dist/
  backend/
    server.js
    .env
```

---

## 1. SSH for GitHub Actions (VPS port 22)

On Windows, generate a deploy key:

```powershell
ssh-keygen -t ed25519 -C "github-actions-staging" -f $env:USERPROFILE\.ssh\workflow_staging_deploy -N ""
```

On the VPS, add the **public** key to the deploy user's `~/.ssh/authorized_keys`. Keep the **private** key for GitHub. Never commit it.

Test:

```powershell
ssh -i $env:USERPROFILE\.ssh\workflow_staging_deploy -p 22 root@YOUR_VPS_IP
```

Use a non-root deploy user in production-grade setups; root is fine only while the box is empty.

---

## 2. Create the staging MySQL database on the VPS

This is the Hostinger equivalent of A2 phpMyAdmin → New database. Do it over SSH, not against A2.

```bash
sudo apt update
sudo apt install -y mariadb-server
sudo mysql
```

MariaDB matches A2/cPanel more closely than MySQL 8. Inside the MySQL prompt:

```sql
CREATE DATABASE workflow_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'workflow_stg'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON workflow_staging.* TO 'workflow_stg'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Leave MySQL bound to localhost. Do **not** open port 3306 on the public firewall.

Optional: install phpMyAdmin on the VPS if you want the same UI as A2. The Node app does not need it.

Fill `deploy/staging.backend.env.example` with:

- `DB_HOST=127.0.0.1`
- `DB_NAME=workflow_staging`
- `DB_USER=workflow_stg`
- `DB_PASSWORD=` the password you set above

First GitHub deploy with **bootstrap_db = true** creates tables in this empty database. Do not import the A2 dump unless you want a data copy.

### Optional: copy live data into staging (never the other way)

On A2 (phpMyAdmin → Export, or SSH):

```bash
mysqldump -u bylinelm_workflow_db -p bylinelm_workflow_db > workflow_live.sql
```

Copy that file to the VPS, then:

```bash
mysql -u workflow_stg -p workflow_staging < workflow_live.sql
```

Skip `bootstrap_db` if you imported a dump (the tables already exist). Do this only when you need realistic staging data. Live is not updated by this import.

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
| `SSH_PORT` | `22` |
| `SSH_USER` | `root` or your deploy user |
| `SSH_KEY` | **private** key (`workflow_staging_deploy`) including `BEGIN` / `END` lines |
| `DEPLOY_PATH` | `/var/www/workflow-staging` |
| `BACKEND_ENV` | full contents of the filled staging `.env` |
| `PROCESS_MANAGER` | `pm2` |
| `PM2_APP_NAME` | `workflow-staging` |

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
5. If files uploaded but health check failed: SSH in, run `pm2 list` and `pm2 logs workflow-staging`, then hit `https://YOUR-STAGING-DOMAIN/api/health`
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
Wrong key, key not in `authorized_keys`, or wrong port (VPS is **22**; A2 is often 22 or 7822).

**npm / node not found on the VPS**  
Install Node 20 and PM2 globally (`npm i -g pm2`), then re-run the workflow.

**Health check 502 / timeout**  
nginx is not proxying to Node, or PM2 is down. Check `pm2 list` and the site vhost.

**Database access denied**  
`DB_NAME` / `DB_USER` / `DB_PASSWORD` in staging `BACKEND_ENV` must match the VPS `mysql` user you created. Do not paste A2 phpMyAdmin credentials here.

**Frontend calls production API**  
`vars.API_URL` on the staging environment must be `https://YOUR-STAGING-DOMAIN/api` (rebuild required; it is baked in at `npm run build`).

**CORS errors**  
`CORS_ORIGIN` in `BACKEND_ENV` must be the staging origin with `https://` and no trailing slash.

**PM2 cwd errors on live**  
`ecosystem.config.js` now uses `__dirname`. After the first production deploy, `pm2 reload workflow-backend` is enough.
