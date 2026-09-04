# Byline Workflow — Project Overview

**Product:** Byline Workflow (Workflow LMS)  
**Live URL:** https://workflow.bylinelms.com  
**Type:** Internal project, task, and team management system for educational content production

This document describes the overall system: what it does, how it is structured, who uses it, and how the main modules fit together.

For a deep dive on creating many tasks at once and labeling people/work, see **[BULK_UPLOAD_AND_TAGGING.md](./BULK_UPLOAD_AND_TAGGING.md)**.

---

## 1. What this product is

Byline Workflow is a web application used to plan, assign, track, and review work across educational publishing projects.

A typical project is a curriculum title (for example a UAE Citizen / LMS product). Work is broken into:

1. **Project** — the title or initiative
2. **Category + stages** — the production pipeline (Plan, Core Development, Review, and so on)
3. **Educational hierarchy** — Grade → Book → Unit → Lesson
4. **Tasks** — the actual work items assigned to people
5. **Review / rework** — submit, review, return, redo, resubmit, with optional deadlines

The app is used by **admins**, **project managers**, and **team members (employees)**.

---

## 2. Who uses it

| Role | How they sign in | What they can do |
|------|------------------|------------------|
| **Admin** | Admin login (`Auth`) or SSO | Full access: projects, teams, tasks, settings, analytics, bulk upload, access control |
| **Project Manager** | Team member login | Broader portal access (dashboard, projects, teams, analytics, allocations) based on permissions |
| **Employee** | Team member login | Assigned tasks, notifications, remarks, timers — extra pages only if granted |

Permissions are stored per team member (`view_dashboard`, `view_projects`, `view_tasks`, `view_team`, `view_analytics`, `view_allocations`, `view_top_performers`, `view_notifications`) and managed under **Settings → Access Management**.

---

## 3. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MySQL (`mysql2`) |
| Realtime | Socket.IO + SSE notifications |
| Auth | JWT (admin + team), optional SSO |
| Spreadsheets | `xlsx` (frontend), `exceljs` (backend export) |
| Hosting | Production API/app at `workflow.bylinelms.com` |

**Frontend root:** `src/`  
**Backend root:** `backend/`  
**Default local frontend:** Vite on port `5173`  
**Default local backend:** port `3001` (production uses `443`)

API base URL is `VITE_API_URL` (falls back to `https://workflow.bylinelms.com/api`).

---

## 4. Application modules

Sidebar navigation (admin / PM app):

| Screen | Component | Purpose |
|--------|-----------|---------|
| Dashboard | `Dashboard.tsx` | Counts, progress, overdue work, top performers |
| Projects | `ProjectManager.tsx` | Create/edit projects, category, dates, stages, hierarchy |
| Teams | `TeamManager.tsx` | Members, teams, skills, performance flags |
| Tasks | `TaskManager.tsx` | List, filter, create, bulk upload, export, assign |
| Allocations | `DailyAllocations.tsx` | Hours per person per day / project / task |
| Top Performers | `TopPerformers.tsx` | Ranking and skill search |
| Analytics | `Analytics.tsx` | Project/skill/category analytics |
| Core Analytics | `CoreAnalytics.tsx` | Deeper operational analytics |
| Manage Activities | `Notification.tsx` | Activity / notification feed |
| Settings | `Settings.tsx` | Categories, skills, stages, users, access, API keys |

Team members who are not admins land in **Team Member Portal** (`TeamMemberPortal.tsx`) with their own task list, task detail, remarks, and timers.

---

## 5. Domain model

```
Category ──► Stage templates (pipeline stages)
    │
    └── Project (belongs to a category, has a current stage)
            │
            ├── Educational hierarchy
            │     Grade → Book → Unit → Lesson
            │
            ├── Tasks
            │     • status, priority, dates, hours
            │     • assignees (admin or team)
            │     • optional skills (task_skills)
            │     • optional grade/book/unit/lesson
            │     • file location (server path)
            │     • remarks, rework, resubmission deadline
            │
            └── Team membership + daily allocations
```

### Task statuses

`not-started` · `in-progress` · `under-review` · `completed` · `blocked` · `on-hold` · `returned` · `redo-requested` · `resubmitted`  
(Bulk upload also accepts `skipped`.)

### Priorities

`low` · `medium` · `high` · `urgent`

---

## 6. Backend API map

Mounted in `backend/server.js`:

| Prefix | Area |
|--------|------|
| `/api/auth` | Admin/team login, tokens |
| `/api/projects` | Projects |
| `/api/categories` | Project categories |
| `/api/stages` · `/api/stage-templates` | Pipeline stages |
| `/api/tasks` | Tasks, remarks, review, bulk upload, bulk assign, export, timers |
| `/api/skills` | Skill (tag) master list |
| `/api/team` | Team members and teams |
| `/api/grades` · `/api/books` · `/api/units` · `/api/lessons` | Educational hierarchy |
| `/api/allocations` | Daily hour allocations |
| `/api/performance-flags` | Employee performance color flags |
| `/api/access` | Role/permission management |
| `/api/dashboard` | Overview metrics |
| `/api/search` | Global search |
| `/api/api-keys` | External API keys |
| `/api/admin` | Admin-only team tools |

Auth middleware: `requireAuth`, `requireAdminAuth`, `requireTeamAuth`, `requireAdminOrPMAuth`.

---

## 7. Key workflows

### Project setup

1. Define a **category** and its **stages** in Settings.
2. Create a **project** and pick the category + current stage.
3. Optionally bulk-upload or manually build **Grade → Book → Unit → Lesson**.
4. Add people to the project team.

### Task work

1. Admin/PM creates tasks (one-by-one or **Bulk Upload**).
2. Tasks are assigned by email/user, optionally tagged with **skills**.
3. Employee starts a timer, works, adds remarks, submits for review.
4. Reviewer approves, or returns / requests redo with a resubmission deadline.
5. Rework count and performance flags (red / orange / yellow / green) track quality.

### Reporting

- Filter the task list (status, priority, project, stage, team, assignee, due date, date range).
- Export filtered or selected tasks to Excel.
- Use Dashboard, Analytics, Core Analytics, and Top Performers.

---

## 8. Bulk upload (summary)

There are **two** bulk upload tools:

| Tool | Where | What it creates |
|------|-------|-----------------|
| **Bulk Upload Tasks** | Tasks page → Bulk Upload | Up to 500 tasks from Excel/CSV |
| **Bulk Upload Educational Hierarchy** | Project hierarchy view | Grades, books, units, lessons |

Task bulk upload matches **Project** and **Stage** names (fuzzy), assigns people by email, and runs in a single database transaction (one bad row rolls everything back).

Full template, validation, matching rules, and API details: **[BULK_UPLOAD_AND_TAGGING.md](./BULK_UPLOAD_AND_TAGGING.md)**.

---

## 9. Tagging system (summary)

The product does not use a free-text “tags” field on live tasks. Tagging is done through:

| Tag type | What it labels | Managed in |
|----------|----------------|------------|
| **Skills** | People and (optionally) tasks | Settings → Skills |
| **Filter chips** | Active task-list filters | Tasks page |
| **Performance flags** | Employee quality (color) | Task / team UI |
| **Hierarchy path** | Grade / Book / Unit / Lesson | Project hierarchy |
| **Category + stage** | Pipeline position | Settings + project |

Skills are the main reusable tag: a master list (`skills`), linked to members (`team_member_skills`) and tasks (`task_skills`).

Full model, APIs, and how this relates to bulk upload: **[BULK_UPLOAD_AND_TAGGING.md](./BULK_UPLOAD_AND_TAGGING.md)**.

---

## 10. Repository layout

```
Workflow-Management-System/
├── src/                    # React frontend
│   ├── components/         # Screens, modals, UI
│   ├── contexts/           # Auth + app state
│   ├── services/           # API + tokens + notifications
│   ├── hooks/              # Permissions, etc.
│   ├── types/              # TypeScript models
│   └── utils/              # Filters, progress, dates (IST)
├── backend/                # Express API
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── migrations/
│   ├── services/
│   └── utils/
├── project/                # Secondary/curriculum companion UI
├── supabase/               # Older schema snapshots (not the live MySQL source)
└── docs in this folder     # This overview + feature guides
```

---

## 11. Local run (typical)

**Backend**

```bash
cd backend
npm install
# configure .env (DB, JWT, CORS)
npm run dev
```

**Frontend**

```bash
npm install
npm run dev
```

Set `VITE_API_URL` to the local API (for example `http://localhost:3001/api`) when not hitting production.

---

## 12. Related documents

| File | Contents |
|------|----------|
| [BULK_UPLOAD_AND_TAGGING.md](./BULK_UPLOAD_AND_TAGGING.md) | Bulk task upload + tagging/skills system |
| `backend/MIGRATIONS.md` | How database migrations work |
| `backend/DEPLOYMENT-GUIDE.md` | Production deploy notes |
| `DATE_RANGE_FILTER_USAGE_GUIDE.md` | Task date-range filter and export |
