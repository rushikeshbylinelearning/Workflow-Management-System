/**
 * taskSummaryCache.js
 *
 * Server-side in-memory cache for the task dashboard-summary endpoint.
 * Stores one aggregated result per "scope key" (admin = global, team = per-user).
 * TTL: 60 seconds.  Invalidated explicitly whenever tasks are mutated.
 */

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/** @type {Map<string, { data: object, expiresAt: number }>} */
const store = new Map();

/**
 * Build a stable cache key from query parameters.
 * The key captures every filter dimension so that different filter combos
 * never collide.
 *
 * @param {object} filters - Raw query params from the request
 * @param {string|number|null} userId - The requesting user's ID (for team-scoped keys)
 * @param {'admin'|'team'} userType
 * @returns {string}
 */
function buildSummaryKey(filters = {}, userId = null, userType = 'admin') {
  const {
    project_id = '',
    team_id = '',
    assignee_id = '',
    assigneeIdIn = '',
    stage_id = '',
    grade_id = '',
    book_id = '',
    unit_id = '',
    lesson_id = '',
    dateRangeStart = '',
    dateRangeEnd = '',
    search = '',
  } = filters;

  const userScope = userType === 'team' ? `team:${userId}` : 'admin';

  return [
    userScope,
    project_id, team_id, assignee_id, assigneeIdIn,
    stage_id, grade_id, book_id, unit_id, lesson_id,
    dateRangeStart, dateRangeEnd, search,
  ].join('|');
}

/**
 * Retrieve a cached summary if still valid.
 * @param {string} key
 * @returns {object|null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a summary result.
 * @param {string} key
 * @param {object} data
 */
function set(key, data) {
  store.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Invalidate all cached summaries (called on any task mutation).
 * Because filters are user-specific and the result depends on global state,
 * it is safer to wipe all entries than to attempt partial invalidation.
 */
function invalidateAll() {
  store.clear();
}

/**
 * Invalidate only admin-scope entries (when a task changes but we want
 * team-member caches to remain valid until their own TTL expires).
 * For simplicity we currently call invalidateAll() everywhere.
 */
function invalidateAdmin() {
  for (const key of store.keys()) {
    if (!key.startsWith('team:')) {
      store.delete(key);
    }
  }
}

module.exports = { buildSummaryKey, get, set, invalidateAll, invalidateAdmin };
