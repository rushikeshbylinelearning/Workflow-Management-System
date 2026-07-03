# Codebase Audit Report

**Project:** Workflow LMS (`workflow.bylinelms.com`)  
**Audit date:** May 30, 2026  
**Scope:** Full repository — main app (`src/`, `backend/`), secondary curriculum app (`project/`), migrations, tooling  
**Method:** Static analysis (TypeScript, ESLint, Vite build, Node syntax check), manual code review of recently changed files  
**Changes made:** None — read-only audit

---

## Executive Summary

The **main workflow application builds successfully** (`npm run build`, `tsc --noEmit` both pass), but the codebase has **several security and logic issues** that should be addressed before production use, especially around **authorization**, **task access control**, and the **new rework/resubmission feature set**.

| Category | Count |
|----------|-------|
| Critical | 3 |
| High | 12 |
| Medium | 18 |
| Low / code quality | 15+ |

**Top risks:**

1. Unauthenticated debug endpoint exposing task data  
2. Missing admin-only checks on task review — any logged-in user (including team members) can approve/deny tasks  
3. Missing per-task access checks on get/update/delete — IDOR vulnerability  
4. Frontend quick-deny flows bypass required resubmission deadline when backend feature flag is on  
5. Weak HTML sanitization for user-authored remarks (XSS)  
6. `.env` files tracked in Git (secrets exposure risk)  
7. New SQL migrations must be applied in order or rework features fail at runtime  

---

## Build & Static Analysis

| Check | Result | Notes |
|-------|--------|-------|
| `npm run build` (Vite) | **Pass** | Bundle ~1.46 MB — chunk size warning |
| `npx tsc --noEmit` | **Pass** | No TypeScript compile errors in main app |
| `npm run lint` (ESLint) | **Fail** | **928 problems** (903 errors, 25 warnings) |
| `node --check backend/server.js` | **Pass** | Main server syntax OK |
| `node --check backend/add-two-tables.js` | **Fail** | Duplicate `const sqlFile` declaration (line 51) |
| `node --check backend/controllers/authController.js` | **Pass** | Duplicate `generateRefreshToken` function (lines 35–41 and 52–58) — dead code, ESLint parse error |

Most ESLint failures are `@typescript-eslint/no-explicit-any` and unused imports across `src/` and `project/`. These do not block production build but indicate weak typing and maintainability debt.

---

## Critical Issues

### C1. Unauthenticated task data endpoint

**Location:** `backend/routes/tasks.js` line 301, `backend/controllers/taskController.js` ~291–307  

`GET /api/tasks/test/stage-filter` has **no authentication middleware**. It returns up to 50 tasks plus category stages to anyone who can reach the API.

**Impact:** Information disclosure in production.  
**Correction:** Remove route in production or protect with `requireAdminAuth`.

---

### C2. Authorization bypass on task review (approve/deny)

**Location:** `backend/controllers/taskController.js` ~1158–1165, `backend/routes/tasks.js` ~375–387  

`reviewTaskCompletion` checks only `if (!req.user)` but the route uses `requireAuth`, so **any authenticated admin or team JWT** can approve/deny tasks. Error message says "Only admins" but type is never checked.

**Impact:** Team members can complete review workflow, set rework status, resubmission deadlines, and write `reviewed_by` with team member IDs.  
**Correction:** Add `req.user.type === 'admin'` check or use `requireAdminAuth` on the route.

---

### C3. IDOR on single-task operations (no `assertTaskAccess`)

**Location:** `backend/controllers/taskController.js` — `getTask` (~514), `updateTask` (~602), `deleteTask`; `backend/utils/taskAccess.js`  

`assertTaskAccess` is used for remark history and add-remark only. Per-ID read/update/delete routes do **not** verify the caller is assigned or has project access.

**Impact:** A team member who knows a task ID can read, modify, or delete tasks outside their assignments. List endpoints correctly scope team users; single-ID routes do not.  
**Correction:** Call `assertTaskAccess(id, req.user)` at the start of every task-by-id handler; restrict destructive ops to admin/PM roles.

---

## High Severity Issues

### H1. Private remarks never filtered for team users

**Location:** `backend/controllers/taskController.js` ~1023–1026  

```javascript
const isAdmin = req.user;  // always truthy when authenticated
if (!isAdmin) query += ' AND tr.is_private = 0';  // never runs
```

**Impact:** Team members see admin-private remarks.  
**Correction:** `const isAdmin = req.user?.type === 'admin';`

---

### H2. Team passcodes stored and returned in plain text

**Location:** `backend/controllers/teamController.js` ~44–50, ~53–80  

Passcodes compared with `!==` (not hashed). Login response spreads full `member` row including `passcode` into `userData`.

**Impact:** Credential theft if responses are logged or intercepted; DB breach exposes passcodes.  
**Correction:** bcrypt hash on create/update; strip `passcode` from all API responses.

---

### H3. Global notification feed for all authenticated users

**Location:** `backend/routes/tasks.js` ~369, `backend/controllers/taskController.js` ~1050–1083  

`GET /api/tasks/notifications` uses `requireAuth` only. Returns **all** pending extension requests and recent remarks system-wide.

**Impact:** Team members (or any auth user) see cross-project sensitive activity.  
**Correction:** `requireAdminAuth` or scope queries to caller's projects.

---

### H4. Any authenticated user can delete any remark

**Location:** `backend/controllers/taskController.js` ~1036–1042, `backend/routes/tasks.js` ~570–578  

No ownership check, no `assertTaskAccess`, no admin-only guard.

**Correction:** Admin-only or author-only with task access verification.

---

### H5. Team members can set task status to `completed` directly

**Location:** `backend/controllers/taskController.js` ~602–689  

`updateTask` has no role-based status transition rules. Route validation allows `completed`. Team can bypass `under-review` → admin review flow.

**Correction:** For `user.type === 'team'`, allow only safe transitions (e.g. → `under-review`); block direct `completed`.

---

### H6. Admin session validation disabled

**Location:** `backend/middleware/auth.js` ~29–41, ~206–218  

Queries against `admin_sessions` are commented out (TODO). Revoked sessions / logout do not invalidate JWT until expiry.

**Correction:** Re-enable session validation or implement token versioning/blocklist.

---

### H7. Migration order dependency — rework features break if incomplete

**Required migrations (in order):**

| File | Purpose |
|------|---------|
| `add_task_returned_status.sql` | Status values `returned`, `redo-requested`, `resubmitted` |
| `add_task_resubmission_deadline.sql` | `resubmission_deadline`, `resubmission_set_by`, `resubmission_set_at` |
| `add_task_remark_history.sql` | `task_remark_history` table (enum **without** `returned_for_rework`) |
| `add_task_rework_count.sql` | `rework_count` column + enum value `returned_for_rework` |

If `add_task_rework_count.sql` is not run after remark history migration, `taskReworkService` logging fails on `action_type = 'returned_for_rework'`. Missing columns cause 500 errors on list/review endpoints.

**Correction:** Document ordered runbook; add startup schema validation; consider single combined migration.

---

### H8. Quick deny bypasses resubmission deadline (frontend ↔ backend mismatch)

**Locations:**

- `src/components/TaskManager.tsx` ~762–765  
- `src/components/ProjectDetails.tsx` ~1303–1305  
- `src/components/Notification.tsx` ~210–212  

These call `taskService.reviewTask(id, 'deny')` with **no** `review_notes` or `resubmission_deadline`. When backend `ENABLE_RESUBMISSION_DEADLINE=true`, deny requires a deadline.

Detail view (`TaskDetails.tsx`) enforces notes + picker; list/project/notification views do not.

**Correction:** Route all deny actions through the same confirm flow as detail view, or disable inline deny when feature flag is on.

---

### H9. API error handling assumes Axios shape; service uses `fetch`

**Locations:** `src/services/apiService.ts` ~38–45; `src/components/TaskDetails.tsx` ~291–306; `src/components/TeamTaskDetail.tsx` ~220–235  

`handleResponse` throws `new Error(message)` — no `error.response`. Catch blocks check `error.response?.data?.error?.message`, so **server validation messages never surface**; users see generic errors.

**Correction:** Introduce typed `ApiError` with `code`, `message`, `status`; throw from `handleResponse`.

---

### H10. Weak XSS sanitization in rich-text display

**Location:** `src/components/ui/RichTextEditor.tsx` ~237–251  

Regex-based stripping then `dangerouslySetInnerHTML`. Misses `<img onerror>`, `<svg/onload>`, `<iframe>`, etc. Remarks are user-authored HTML from Quill.

**Correction:** Use DOMPurify with an allowlist. `escapeHtml.ts` exists but is unused here.

---

### H11. Fetch race conditions in task detail views

**Locations:** `TaskDetails.tsx`, `TeamTaskDetail.tsx`, `TaskRemarksTimeline.tsx`  

No abort/generation guard on task fetch, remarks, or timeline. Fast navigation can apply stale responses to the wrong task. `TaskManager` uses `fetchGenerationRef`; detail views do not.

**Correction:** `AbortController` or monotonic request ID; ignore stale results.

---

### H12. Secrets in version control

**Location:** Git tracked files  

Despite `.gitignore` entries, these are **still tracked**:

- `.env`
- `.env.development`
- `.env.production`
- `backend/.env`

**Impact:** Database credentials, JWT secrets, and API keys may be exposed in repo history.  
**Correction:** `git rm --cached` env files, rotate all secrets, use `.env.example` only.

---

## Medium Severity Issues

### M1. Status validation inconsistent with rework model

**Location:** `backend/routes/tasks.js` ~91–94 vs `taskController.js` ~1299  

Express validators allow 7 statuses; controller `VALID_STATUSES` includes `returned`, `redo-requested`, `resubmitted`. API clients cannot legally send rework statuses via validated create/update routes; bulk upload accepts them.

---

### M2. Deny/rework path skips `denied` history entry

On deny when `incrementRework` succeeds, only `RETURNED_FOR_REWORK` is logged — not `DENIED`. Export merges admin history using `denied` action type → incomplete audit trail.

---

### M3. Remarks stored unsanitized in `task_remarks`

History path uses `sanitizeRemarkText`; live `task_remarks.remark` inserted raw. Stored XSS if UI renders HTML without proper sanitization.

---

### M4. `reviewed_by` / `resubmission_set_by` can reference team user IDs

Foreign key/display joins expect admin IDs; combined with H2 authorization bypass, attribution breaks.

---

### M5. API key accepted in query string

**Location:** `backend/middleware/auth.js` ~454, ~496–498  

`?api_key=` may appear in logs, browser history, Referer headers.

---

### M6. WebSocket/SSE trust JWT without active-user re-check

**Locations:** `backend/socketServer.js`, `backend/sseServer.js`  

Deactivated users with unexpired tokens can still connect. SSE often passes token in query string.

---

### M7. `formatDateIST` may shift calendar dates

**Location:** `backend/controllers/taskController.js` ~7–24  

Fixed +5:30 ms offset then `toISOString().split('T')[0]` (UTC date), not true IST calendar date for all inputs.

---

### M8. `getMyTasks` missing resubmission field enrichment

**Location:** `backend/controllers/teamController.js` ~141  

Uses `attachReworkFieldsBatch` only, not `resubmissionDeadline.attachResubmissionFieldsBatch` (used in admin task lists). Team portal may show incomplete rework/deadline data.

---

### M9. Frontend/backend feature-flag mismatch

Frontend: `VITE_ENABLE_RESUBMISSION_DEADLINE`, `VITE_ENABLE_REWORK_HIGHLIGHT`  
Backend: `ENABLE_RESUBMISSION_DEADLINE`, `ENABLE_REWORK_HIGHLIGHT`  

Flags can diverge across deploy environments → UI/API behavior mismatch.

---

### M10. Inconsistent overdue / days-until-due logic

**Locations:** `TaskDetails.tsx`, `TeamTaskDetail.tsx`, `TaskManager.tsx`  

Some views normalize to local midnight; others use raw `Date` comparison. Same task can appear overdue in one view and not another. Date-range filter uses UTC ISO date strings, shifting calendar day for IST users.

---

### M11. `TeamTaskDetail` uses stale prop `task` after API refresh

**Location:** `src/components/TeamTaskDetail.tsx`  

`localTask` refreshed via API, but header actions, overdue logic, and modals still read prop `task`. After submit-for-review, UI can show wrong buttons until parent reloads.

---

### M12. Optimistic timeline not rolled back on failure

**Locations:** `TaskDetails.tsx`, `TeamTaskDetail.tsx`  

On remark/review failure, `setOptimisticTimelineEntry` not cleared in `catch` — fake timeline entries persist until refresh.

---

### M13. `TaskManager` stats cache goes stale after mutations

**Location:** `TaskManager.tsx` ~277–290, `taskManagerCache.ts`  

Dashboard stat cards may stay wrong after approve/deny/create/delete until manual refresh event.

---

### M14. Double client-side filtering + pagination edge cases

**Location:** `TaskManager.tsx`, `taskListFetch.ts`  

Backend returns all rows for some filter modes, then client filters again. `totalTasks`/`totalPages` can disagree with visible rows → empty pages or wrong counts.

---

### M15. `ResubmissionDeadlinePicker` effect may reset user selection

**Location:** `ResubmissionDeadlinePicker.tsx` ~38–45  

`useEffect` deps omit `value`/`onChange`; toggling deny radio can re-trigger default deadline.

---

### M16. `TeamMemberPortal` history / hooks issues

Permission redirect effect missing deps; `pushState` on every view change pollutes browser history; realtime reconnects on every `userProjects` change.

---

### M17. `Header` notification polling skipped when SSE connected

When SSE is active, 5-minute polling interval never starts — count relies entirely on realtime events.

---

### M18. Socket notification queue unbounded

**Locations:** `backend/socketServer.js`, `backend/sseServer.js`  

If no admin connects, `pendingNotifications` grows without cap.

---

## Low Severity / Code Quality

| ID | Issue | Location |
|----|-------|----------|
| L1 | Duplicate `generateRefreshToken` function (dead code) | `backend/controllers/authController.js` 35–41, 52–58 |
| L2 | Duplicate `const sqlFile` — script cannot run | `backend/add-two-tables.js` 30, 51 |
| L3 | `assertTaskAccess` imported but unused | `backend/services/taskRemarkHistoryService.js` |
| L4 | One socket per user ID — second tab overwrites first | `backend/socketServer.js` |
| L5 | `escapeHtml.ts` exists but unused | `src/utils/escapeHtml.ts` |
| L6 | `Task.id` typed as `string`; API returns numbers | `src/types/index.ts` |
| L7 | Confusing component naming: `TaskDetails.tsx` exports `TeamTaskDetail as TaskDetails`; separate `TeamTaskDetail.tsx` | Maintainability risk |
| L8 | `belongsInOverdueSection` excludes zero-progress overdue tasks | `src/utils/reworkHighlight.ts` |
| L9 | Verbose `console.log` / PII in production paths | `taskController.js`, `socketServer.js` |
| L10 | 928 ESLint issues (mostly `any`, unused vars) | `src/`, `project/` |
| L11 | Large JS bundle without code splitting | Vite build warning |
| L12 | No automated backend tests (`"test": "echo Error..."`) | `backend/package.json` |
| L13 | Secondary `project/` app has many lint errors | Curriculum module — separate from main workflow |
| L14 | `task_remark_history.updated_at ON UPDATE` allows row mutation | Migration design |
| L15 | Stale closure / suppressed `react-hooks/exhaustive-deps` | Multiple components |

---

## Positive Patterns Observed

- **Rework increment race protection:** conditional `UPDATE ... WHERE status IN ('under-review', 'submitted')` in `taskReworkService.js`  
- **Remark rate limiting:** `remarkSubmitRateLimit` in `routes/tasks.js`  
- **Export scoping for team:** `taskExportService.js` restricts exports to assigned tasks  
- **Parameterized SQL:** widespread use of `?` placeholders; sort columns whitelisted  
- **Task list fetch generation guard:** `fetchGenerationRef` in `TaskManager` prevents stale list responses  
- **IST date parsing:** `dateTimeIST.ts` / `parseApiDateTime` treat bare MySQL datetimes as IST  
- **Timeline remark text:** rendered as React text nodes (no HTML injection on timeline)  
- **Auth schema fix documented:** `DATABASE_SCHEMA_FIX.md` — `name`/`role` vs `full_name`/`position` in `auth.js`  

---

## Recommended Fix Priority

### Immediate (before next production deploy)

1. Remove or protect `GET /api/tasks/test/stage-filter` (C1)  
2. Enforce admin-only on task review and extension review (C2, H4 context)  
3. Add `assertTaskAccess` to all task-by-id routes (C3)  
4. Fix private remark filter bug (H1)  
5. Verify and run migrations in order (H7)  
6. Unify deny flows with resubmission deadline (H8)  
7. Remove tracked `.env` files and rotate secrets (H12)  

### Short term

8. Hash team passcodes; strip from responses (H2)  
9. DOMPurify on `RichTextDisplay` (H10)  
10. Typed `ApiError` + fix catch blocks (H9)  
11. Abort/stale guards on detail fetches (H11)  
12. Re-enable session validation (H6)  
13. Align frontend/backend feature flags (M9)  
14. Use `localTask` consistently in `TeamTaskDetail` (M11)  

### Medium term

15. Centralize date/overdue utilities (M10)  
16. Fix stats cache invalidation (M13)  
17. Align status validators with rework model (M1)  
18. Reduce ESLint debt and add backend tests  
19. Code-split large frontend bundle  

---

## Appendix: Files Reviewed (Recent Changes)

**Backend:** `taskController.js`, `projectController.js`, `gradeController.js`, `teamController.js`, `auth.js`, `tasks.js`, export/rework/remark services, `sanitizeRemark.js`, `taskAccess.js`, `socketServer.js`, `sseServer.js`, migrations  

**Frontend:** `TaskDetails.tsx`, `TaskManager.tsx`, `TeamMemberPortal.tsx`, `TeamTaskDetail.tsx`, `ProjectDetails.tsx`, `MainApp.tsx`, `Header.tsx`, `TeamManager.tsx`, resubmission/remark components, `apiService.ts`, `types/index.ts`, utility modules listed in git status  

---

*This report was generated by automated and manual audit. No source code was modified during the audit.*
