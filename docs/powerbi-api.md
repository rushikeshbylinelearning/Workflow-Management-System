# Power BI read API

Read-only JSON and CSV feeds for Power BI Desktop. Base path: `/api/v1`.

The contract file is `workflow-powerbi-api.openapi.yaml`. It was written from the implementation brief because that file was not already in the repo. The PDF name `/taskhistory` is served as `/task-history`.

## Setup

1. Apply the migration (idempotent, does not delete tasks or remarks):

```bash
cd backend
node scripts/migrate-powerbi.js
```

2. Create a key. The plaintext is printed once. Keys are stored as SHA-256 hashes, expire after 90 days by default, and are bound to project ids.

```bash
node scripts/powerbi-keys.js create --name "Power BI English" --projects 58 --scope read
node scripts/powerbi-keys.js list
node scripts/powerbi-keys.js rotate --id 1
node scripts/powerbi-keys.js revoke --id 1
```

`--scope read_admin` is required for `include_private=true`.

The same operations are available to a logged-in admin in Settings → API Keys, and at `/api/admin/powerbi-keys`. The older dashboard keys on `/api/api-keys` are not used by `/api/v1`.

3. Restart the API process so it loads the new routes.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PROJECT_TIMEZONE` | `Asia/Kolkata` | Calendar date used for overdue, delay, and days-until-due |
| `POWERBI_COMPLETION_STATUSES` | `completed` | Statuses that count as finished. Add `under-review` here if that decision changes |
| `POWERBI_RATE_LIMIT_PER_MINUTE` | `60` | Per key |
| `POWERBI_KEY_TTL_DAYS` | `90` | Expiry used when a key is created |
| `EXPOSE_FILE_PATHS` | `false` | When false, `server_location` and `file_name` are omitted |

In production, calls that are not HTTPS are rejected unless the host is localhost. This machine's `NODE_ENV` is often `production` while the API listens on `http://127.0.0.1:3005`, and that loopback address is allowed.

## Call shape

```http
GET /api/v1/projects/58/tasks?page=1&page_size=1000
X-API-Key: pbi_...
```

JSON list responses use `meta` (`project_id`, `generated_at`, `page`, `page_size`, `total_rows`, `total_pages`, `next_page`) and `data`. `next_page` is null on the last page. CSV uses the same columns and puts paging in `X-Total-Rows`, `X-Page`, `X-Page-Size`, `X-Total-Pages`, and `X-Next-Page`.

`updated_since` is an ISO UTC timestamp. Omit it for a full reload. Rows are ordered by `updated_at` then the primary key.

## Power BI Desktop

Use the Web connector. Credential type is Anonymous. The key is sent as a header inside the query, not as the connector credential.

Parameters: `BaseUrl` (text, for example `http://127.0.0.1:3005/api/v1/`), `ProjectId` (text `58`), `ApiKey`, `PageSize` (1000).

```powerquery
let
  GetPage = (page as number) as record =>
    Json.Document(Web.Contents(BaseUrl, [
      RelativePath = "projects/" & ProjectId & "/tasks",
      Query = [page = Text.From(page), page_size = Text.From(PageSize)],
      Headers = [#"X-API-Key" = ApiKey]
    ])),
  Pages = List.Generate(
    () => GetPage(1),
    each _ <> null,
    each if _[meta][next_page] = null then null else GetPage(_[meta][next_page]),
    each _[data]
  ),
  AllRows = List.Combine(Pages),
  AsTable = Table.FromList(AllRows, Splitter.SplitByNothing(), {"Row"}),
  Expanded = Table.ExpandRecordColumn(AsTable, "Row",
    {"task_id","task_name","stage","status","priority","progress_pct","assignee_id","assignee_name",
     "hierarchy_node_id","hierarchy_path","grade","start_date","due_date","completed_date",
     "actual_completion_date","delay_days","is_overdue","estimated_hours","actual_hours",
     "remark_count","updated_at","is_deleted"}),
  Active = Table.SelectRows(Expanded, each [is_deleted] = false),
  Typed = Table.TransformColumnTypes(Active, {
    {"task_id", Int64.Type}, {"progress_pct", Int64.Type}, {"delay_days", Int64.Type},
    {"start_date", type date}, {"due_date", type date}, {"completed_date", type date},
    {"actual_completion_date", type date}, {"estimated_hours", type number},
    {"actual_hours", type number}, {"is_overdue", type logical}, {"updated_at", type datetimezone}})
in
  Typed
```

Repeat `GetPage` with `remarks`, `hierarchy`, `task-history`, `assignees`, `stages`, or `meta`.

Relationships:

- Tasks to Hierarchy on `hierarchy_node_id = node_id`. If that is null, there is no curriculum node; `hierarchy_path` is also null.
- Tasks to Assignees on `assignee_id`.
- Tasks to Stages on `stage = stage_name`.
- Remarks to Tasks on `task_id`.
- Task history to Tasks on `task_id`.
- A date table on `due_date`.

## Checks

```bash
cd backend
npm test
node scripts/powerbi-acceptance.js
```

`npm test` covers derived dates and the HTTP error and envelope behavior with a fake database. The acceptance script checks the live database. The 28 Sep 2026 snapshot totals (4,963 tasks, 3,073 remarks, 13 people, stage mix 4,787 / 172 / 4) are compared with whatever is in the database now. Hierarchy 16,731 is the structural expectation for English project 58.

## Open rules

- `under-review` is not treated as completed unless `POWERBI_COMPLETION_STATUSES` says so.
- "Today" for delay and overdue is `PROJECT_TIMEZONE`, default `Asia/Kolkata`.
- Legacy export delay days are not reproduced. Delay is `max(0, today - due)` for open tasks and `max(0, completion - due)` for finished tasks.
- Actual completion is `completed_date`, otherwise the latest non-private remark with type `complete`.
