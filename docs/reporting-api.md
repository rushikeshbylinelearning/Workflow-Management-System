# Workflow Reporting API (Power BI) — Spec v2.0

Read-only, feature-flagged extract API for Power BI and similar tools. **No product-level row cap** — responses are streamed.

## Enable

1. Apply migration (reviewed; not auto-run):

```bash
cd backend
node scripts/migrate-reporting-api.js
```

2. Set in `backend/.env`:

```
REPORTING_API_ENABLED=true
PUBLIC_API_BASE_URL=https://your-host/api
REPORTING_API_KEY_PEPPER=<long random string>
```

3. Restart the API process.

With the flag off (default), all `/api/reporting/*` and `/api/metadata/*` routes return **404**. Existing app behaviour is unchanged.

## Auth

- Header only: `X-API-Key: rpt_...` (query-string keys are rejected)
- Keys are HMAC-SHA256 hashed with `REPORTING_API_KEY_PEPPER`
- Bound to project IDs (or `all`) and field groups
- Create / rotate / revoke: Settings → Reporting API, or `POST/GET/DELETE /api/admin/reporting/keys` (admin JWT)

## Endpoints (all GET unless noted)

| Path | Notes |
|------|--------|
| `/api/reporting/tasks` | Uncapped streamed tasks |
| `POST /api/reporting/tasks/query` | Same; JSON body for long field lists |
| `/api/reporting/comments` | Full remark history (uncapped) |
| `/api/reporting/projects` | Projects in key scope |
| `/api/reporting/users` | Assignees in scope |
| `/api/reporting/hierarchy` | grade → book → unit → lesson |
| `/api/reporting/task-history` | Change events (uncapped) |
| `/api/reporting/attachments` | file name / hasFile only — no paths |
| `/api/metadata/fields\|statuses\|stages\|priorities\|grades\|subjects\|projects\|users` | Catalogs |

Query params: `projectIds` (`1,2` or `all`), `fields`, `status`, `assigneeIds`, `grades`, `fromDate`, `toDate`, `format=json|ndjson`.

Response envelope:

```json
{ "data": [ ... ], "meta": { "count": N, "generatedAt": "…+05:30", "projectIds": [...], "fields": [...] } }
```

## Business rules

- Completed statuses: `completed`, `under-review`
- `actualCompletionDate` = assignee **complete** remark date only (submission), never approval time
- `delayDays` / `overdueFlag` / `completionPercent` computed in **IST** (`Asia/Kolkata`)
- Sensitive fields (`assigneeEmail`, comments, history, attachments) require explicit key field-group / field-name grants

## Power BI M (scheduled refresh safe)

```powerquery
let
  BaseUrl = "https://your-host/api/",
  ApiKey = "YOUR_API_KEY",
  Source = Json.Document(Web.Contents(BaseUrl, [
    RelativePath = "reporting/tasks",
    Query = [projectIds = "all", fields = "projectId,projectName,taskId,taskName,status,assignee,dueDate,actualCompletionDate,delayDays,overdueFlag"],
    Headers = [#"X-API-Key" = ApiKey]
  ])),
  Rows = Source[data],
  AsTable = Table.FromList(Rows, Splitter.SplitByNothing(), {"Row"}),
  Expanded = Table.ExpandRecordColumn(AsTable, "Row", {"projectId", "projectName", "taskId", "taskName", "status", "assignee", "dueDate", "actualCompletionDate", "delayDays", "overdueFlag"})
in
  Expanded
```

## Ops

| Setting | Default | Purpose |
|---------|---------|---------|
| `REPORTING_INTERNAL_BATCH_SIZE` | 1000 | Memory window for keyset streaming (**not** a row cap) |
| `REPORTING_RATE_LIMIT_PER_MINUTE` | 60 | Per-key request rate |
| `REPORTING_MAX_CONCURRENT_PER_KEY` | 2 | Per-key concurrency |

Suggested DB indexes (optional): `tasks(project_id, updated_at, id)`, `tasks(project_id, status)`, `tasks(project_id, end_date)`, `task_remarks(task_id, remark_type, remark_date)`.

## Rollback

1. Set `REPORTING_API_ENABLED=false` and restart (routes 404).
2. Optionally: `node scripts/migrate-reporting-api.js --down` (drops `reporting_*` tables only).

## NOT AVAILABLE fields

`subject`, `curriculum`, `chapter`, `topic`, `parentTask`, client/internal comment types, binary attachment URLs/paths.
