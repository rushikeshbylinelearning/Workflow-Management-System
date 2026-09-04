# Bulk Upload Tasks and Tagging System

This guide covers two related features in Byline Workflow:

1. **Bulk Upload Tasks** — create many tasks from an Excel/CSV file
2. **Tagging system** — skills, filter chips, performance flags, and hierarchy labels

It is written for operators (how to use it) and for developers (how it works). For the rest of the product, see **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**.

---

## Part A — Bulk Upload Tasks

### Where it lives

| Layer | File |
|-------|------|
| UI | `src/components/BulkUploadModal.tsx` |
| Opened from | Tasks page → **Bulk Upload** (`src/components/TaskManager.tsx`) |
| API | `POST /api/tasks/bulk-upload` |
| Handler | `backend/controllers/taskController.js` → `bulkUploadTasks` |
| Route | `backend/routes/tasks.js` |

Who can use it: users who can manage tasks (`canManageTasks` on the Tasks page — typically admin / PM).

There is a **second** bulk tool for curriculum structure (not tasks):

| Tool | UI | API |
|------|----|-----|
| Educational hierarchy | `BulkUploadHierarchyModal.tsx` | `POST /api/grades/bulk-upload` |

That hierarchy upload is described at the end of Part A.

---

### How to use (operator steps)

1. Open **Tasks**.
2. Click **Bulk Upload**.
3. Click **Download Template** (`bulk_tasks_template.xlsx`).
4. Fill one row per task. Keep the header names exactly as in the template.
5. Drag-and-drop or browse to upload `.xlsx`, `.xls`, or `.csv`.
6. Review the preview table.
   - Green banner = all rows passed frontend checks.
   - Red panel = fix those rows and re-upload the file.
7. Click **Upload N Tasks**.
8. On success the task list refreshes.

**Limits**

- Max file size: **2 MB**
- Max rows: **500**
- One sheet only (first sheet is used)

---

### Template columns

| Column | Required | Notes |
|--------|----------|--------|
| **Task Name** | Yes | Task title |
| **Description** | No | Long text |
| **Project** | Yes | Must match an existing project name (see matching rules) |
| **Stage** | Recommended | Must match a stage on that project’s category. If blank, task is created with no stage |
| **Status** | No | Default `not-started` |
| **Priority** | No | Default `medium` |
| **Estimated Hours** | No | Non-negative number. Default `0` |
| **Start Date** | No | `YYYY-MM-DD`. Default = today (IST) |
| **Due Date** | No | `YYYY-MM-DD`. Default = today + 7 days |
| **Assignees** | No | Comma-separated **emails**. Unknown emails are skipped (task still created) |
| **File Location** | No | Stored as `server_location` (UNC/path of assets) |

Example row from the built-in template:

| Task Name | Description | Project | Stage | Status | Priority | Estimated Hours | Start Date | Due Date | Assignees | File Location |
|-----------|-------------|---------|-------|--------|----------|-----------------|------------|----------|-----------|---------------|
| Design Homepage | Create wireframes for the homepage | My Project Name | Plan | not-started | medium | 8 | 2026-04-15 | 2026-04-22 | john@example.com, jane@example.com | `\\Server\Projects\Byline\Assets` |

#### Allowed status values (frontend)

`not-started`, `in-progress`, `under-review`, `completed`, `blocked`, `skipped`

Spaces are converted to hyphens (`In Progress` → `in-progress`).

The backend also accepts: `returned`, `redo-requested`, `resubmitted`, `on-hold`.

#### Allowed priority values

`low`, `medium`, `high`, `urgent`

---

### Date handling

The parser accepts:

- Excel Date cells
- `YYYY-MM-DD`
- `M/D/YYYY` or `MM/DD/YYYY`
- Excel serial numbers

Dates are converted using **local calendar parts** so timezone offset does not shift the day. Backend stores them as `YYYY-MM-DD`.

---

### Project and stage matching

Names are normalized before compare:

- Trim whitespace
- Collapse multiple spaces
- Lowercase
- Convert Unicode dashes (`–`, `—`, etc.) to a plain hyphen

**Project match**

1. Exact normalized name, or
2. Word overlap ≥ **75%** of significant words (length > 2)

Example: `UAE Citizen / Digital Citizen I-JAE` can match `UAE Citizen / Digital Citizen UAE`.  
`Apex` will **not** match `Apex LMS` (only 50% overlap).

If no match, the API returns a hint: `Did you mean "…"?`

**Stage match** (stages come from `category_stages` via the project’s category templates)

1. Exact normalized name, or
2. Excel value starts with DB name + ` -` / `:` / ` –`, or
3. DB name starts with the Excel value (truncated cells)

Example: Excel `Core Development - Build the…` can match DB stage `Core Development`.

---

### Assignee rules

For each email in **Assignees**:

1. Look up active `team_members` by email.
2. If not found, look up `admin_users` by email.
3. Insert `task_assignees` (`assignee_type` = `team` or `admin`).
4. Missing emails are **ignored** — they do not fail the upload.

Bulk upload does **not** currently set skills/tags. Tag people and tasks after upload, or extend the template (see Part B).

---

### Transaction behavior

The whole file is one MySQL transaction.

- Any unmatched project or stage → **ROLLBACK** of all rows already inserted.
- Frontend validation errors block submit.
- Backend row errors return `{ success: false, errors: [{ row, error }] }`.
- On success, project progress is recalculated, then **COMMIT**.

Row numbers in errors are Excel rows (header = row 1, first data row = 2).

---

### API contract

```http
POST /api/tasks/bulk-upload
Authorization: Bearer <access_token or teamToken>
Content-Type: application/json
```

Body: array of objects using the Excel column names:

```json
[
  {
    "rowIndex": 2,
    "Task Name": "Design Homepage",
    "Description": "Create wireframes",
    "Project": "My Project Name",
    "Stage": "Plan",
    "Status": "not-started",
    "Priority": "medium",
    "Estimated Hours": 8,
    "Start Date": "2026-04-15",
    "Due Date": "2026-04-22",
    "Assignees": "john@example.com, jane@example.com",
    "File Location": "\\\\Server\\Projects\\Byline\\Assets"
  }
]
```

Success:

```json
{ "success": true, "created": 12, "message": "12 tasks uploaded successfully" }
```

Validation failure:

```json
{
  "success": false,
  "errors": [{ "row": 4, "error": "Project not found: \"Apex\". Did you mean \"Apex LMS\"?" }]
}
```

Each inserted task sets:

`name, description, project_id, category_stage_id, status, priority, start_date, end_date, progress, estimated_hours, server_location, created_by`

Progress is derived from status (`calculateTaskProgress`).

---

### Related: bulk assign (not Excel)

`POST /api/tasks/bulk-assign`

Assign many existing tasks to one person.

Body: `{ assignee_id, assignee_type, task_ids?, project_id? }`

If `task_ids` is omitted, all **unassigned** tasks are assigned (optionally limited by `project_id`).

---

### Related: bulk upload educational hierarchy

**Where:** Project hierarchy screen → **Bulk Upload**  
**Files:** `src/components/BulkUploadHierarchyModal.tsx`, `backend/controllers/gradeController.js` → `bulkUpload`

Template columns: Grade, Grade Description, Grade Weight, Book, Book Type, Book Description, Book Weight, Unit, Unit Description, Unit Weight, Lesson, Lesson Description, Lesson Weight.

Repeated grade/book/unit names are reused (no duplicate tree nodes). Existing names in the project are merged instead of duplicated. The whole upload is transactional.

---

## Part B — Tagging System

Byline Workflow does **not** expose a free-form `tags` field on the live Tasks UI. An older schema column `tasks.tags` (JSON) exists in `backend/migrations/00_initial_schema.sql` but is **not** used by bulk upload or the current task screens.

Live “tagging” is these four layers.

---

### 1. Skills (primary tags)

Skills are the reusable tag catalog for **people** and **tasks**.

#### Data model

```
skills
  id, name, description

team_member_skills
  team_member_id + skill_id     → tags on a person

task_skills
  task_id + skill_id            → tags on a task
```

A skill can be counted on both sides: `team_member_count` and `task_count` are returned by `GET /api/skills`.

#### Manage the catalog

**UI:** Settings → **Skills** (`src/components/Settings.tsx`)

- Add / edit / delete custom skills
- Default skills cannot be deleted (`isDefault`)

**API** (`backend/routes/skills.js`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/skills` | Any authenticated user |
| GET | `/api/skills/:id` | Any authenticated user |
| POST | `/api/skills` | Admin |
| PUT | `/api/skills/:id` | Admin |
| DELETE | `/api/skills/:id` | Admin |

Create body:

```json
{ "name": "Instructional Design", "description": "ID / storyboarding", "category": "content" }
```

Rules: name required, unique, max 100 characters; description max 500.

#### Tag a team member

When creating or editing a member in **Teams**, select skills. Those names are stored via `team_member_skills`.

Member search also matches skill names (Teams page and Top Performers).

Skills appear as **pills/badges** on:

- Team member cards
- Settings → Users list
- Access Management
- Task detail (`required_skills`) for team and admin views

#### Tag a task

Backend create/update task accepts skill IDs and writes `task_skills` (`taskController.js`).

Frontend create-task modal still maps skill **names → IDs**, but the **Required Skills checkbox grid is currently commented out** in `CreateTaskModal`. So:

- Skill tagging on **people** is active in the UI.
- Skill tagging on **tasks** is supported by the API, and shown on task detail when present, but the create/edit checkboxes are hidden until that UI is re-enabled.

Bulk upload does **not** send a Skills column, so bulk-created tasks have **no** `task_skills` rows unless added later.

#### How to re-enable task skill tags (for developers)

In `src/components/TaskManager.tsx` inside `CreateTaskModal`, uncomment the **Required Skills** block. Submit already converts selected names to IDs:

```ts
skills: skillIds
```

The backend insert is:

```sql
INSERT INTO task_skills (task_id, skill_id) VALUES ...
```

On update it deletes existing `task_skills` for that task and re-inserts.

---

### 2. Filter chips (search tags)

On the Tasks page, active filters render as removable chips (`src/components/TaskSearchFilters.tsx`).

Chip types:

- Status
- Priority (multi)
- Project
- Stage
- Due date preset
- Team
- Assignee / No Assignee
- Custom date range

These chips are **not stored on the task**. They only describe the current list query. Filters persist in session via `src/utils/taskFilterPersistence.ts`.

Assignee pickers also show selected people as blue rounded **tags** (`AssigneeSearch` in `TaskManager.tsx`).

---

### 3. Performance flags (quality tags)

Color tags on a person, optionally linked to a task.

| Type | Typical meaning |
|------|-----------------|
| green | Strong work |
| yellow | Watch / minor issue |
| orange | Repeated / serious issue |
| red | Critical |

**UI:** Flag employee modal from a task (`FlagEmployeeModal.tsx`)  
**API:** `/api/performance-flags`  
**Tables:** `performance_flags`

Shown on team profiles, dashboard, analytics, and task cards (`performance_flag_type` / `performance_flag_reason`).

These are **not** interchangeable with skills. Skills describe capability; flags describe evaluated performance.

---

### 4. Hierarchy and pipeline labels

Every task can also be classified by:

| Label | Source |
|-------|--------|
| Category | Project’s category |
| Stage | `category_stage_id` (pipeline step) |
| Grade / Book / Unit / Lesson | Educational tree on the project |

These act as structured tags for reporting and filtering. Hierarchy can be bulk-loaded (see Part A). Task bulk upload currently sets **project + stage only**, not grade/book/unit/lesson.

---

## How bulk upload and tagging work together today

```
Excel row
   │
   ▼
Bulk upload creates task (project, stage, dates, assignees, file path)
   │
   ├── Skills?          not in template — left empty
   ├── Grade/Book/…?    not in template — left empty
   └── Performance flag? created later by a reviewer, not at upload
```

After upload you can:

1. Open the task and edit assignees / hierarchy.
2. Tag the **people** with skills in Teams (those tags apply across all their work).
3. Filter the new tasks with chips (project, stage, assignee, dates).
4. Use **Bulk Assign** if the sheet had no emails.

---

## Recommended template extension (optional future)

If you need skill tags at upload time, add a column and wire it through:

| New column | Example | Backend work |
|------------|---------|--------------|
| **Skills** | `Illustration, Instructional Design` | Resolve each name in `skills` (create-or-match), insert `task_skills` |
| **Grade** / **Book** / **Unit** / **Lesson** | `Grade 1` / `Math Book 1` / … | Resolve IDs under the matched project, set `grade_id`, `book_id`, `unit_id`, `lesson_id` |

Keep the same all-or-nothing transaction: unknown skill or hierarchy names should fail that row (and roll back the file) so the sheet stays consistent.

Until that exists, treat **Assignees** as the only person-tag on the spreadsheet, and **Project + Stage** as the only classification tags.

---

## Quick troubleshooting

| Problem | Likely cause |
|---------|----------------|
| `Project not found` | Name does not match; check spelling, extra words, or the “Did you mean” hint |
| `Stage … not found for project` | Stage is not on that project’s category, or the cell is a different wording |
| Assignees missing after upload | Email not in `team_members` (active) or `admin_users` |
| Entire upload vanished | One bad row rolled back the transaction — fix that row and re-upload |
| File rejected | Over 2 MB, over 500 rows, empty sheet, or not xlsx/xls/csv |
| Invalid Status / Priority | Use the allowed lists; spaces become hyphens |
| Date shifted by one day | Unlikely with current local-date parser; still prefer `YYYY-MM-DD` |
| Skills not on bulk tasks | Expected — no Skills column in the current template |
