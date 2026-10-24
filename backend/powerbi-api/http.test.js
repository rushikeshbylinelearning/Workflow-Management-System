const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRouter } = require('./router');
const { hashKey } = require('./auth');

const RAW_KEY = 'pbi_test_key_do_not_log';
const KEY_HASH = hashKey(RAW_KEY);

function taskRow() {
  return {
    task_id: 10,
    task_name: 'Lesson draft',
    description: '',
    project_id: 58,
    project_name: 'English',
    stage: 'Subject Matter Development',
    status: 'in-progress',
    priority: 'urgent',
    progress: 40,
    estimated_hours: '8.00',
    actual_hours: 2,
    logged_hours: null,
    assignee_member_id: 5,
    assignee_name: 'Ada',
    assignee_email: 'Ada@Example.com',
    grade_id: 3,
    book_id: null,
    unit_id: null,
    lesson_id: null,
    grade_name: 'Grade 1',
    book_name: null,
    unit_name: null,
    lesson_name: null,
    start_date: '2026-01-01',
    due_date: '2026-01-02',
    completed_date: null,
    remark_count: 1,
    last_remark_date: '2026-01-03',
    complete_remark_date: null,
    server_location: 'D:\\secret\\file.docx',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-04T00:00:00Z',
    is_deleted: 0,
    extension_status: null,
  };
}

function createFakeDb(options = {}) {
  const scope = options.scope || 'read';
  const projects = options.projectIds || [58];
  return {
    async query(sql, params = []) {
      const compact = sql.replace(/\s+/g, ' ');
      if (compact.includes('FROM powerbi_api_keys')) {
        if (params[0] !== KEY_HASH) return [];
        return [{
          id: 7,
          name: 'bi',
          scope,
          project_ids: JSON.stringify(projects),
          expires_at: null,
          revoked_at: options.revoked ? '2020-01-01' : null,
        }];
      }
      if (compact.includes('information_schema.COLUMNS') || compact.includes('information_schema.TABLES')) {
        return [{ ok: 1 }];
      }
      if (compact.includes('SELECT id, name FROM projects')) {
        return Number(params[0]) === 58 ? [{ id: 58, name: 'English' }] : [];
      }
      if (compact.includes('COUNT(*) AS total_rows')) return [{ total_rows: 1 }];
      if (compact.includes('t.name AS task_name')) return [taskRow()];
      if (compact.includes('r.id AS remark_id')) {
        return [{
          remark_id: 4,
          task_id: 10,
          remark_date: '2026-02-01',
          remark_type: 'general',
          added_by_type: 'admin',
          added_by: 1,
          added_by_name: 'Admin',
          remark: '<p>Hello</p>',
          is_private: 0,
          file_name: 'notes.docx',
          server_location: 'D:\\hidden',
          created_at: '2026-02-01T00:00:00Z',
        }];
      }
      if (compact.includes('AS member_id')) {
        return [{ member_id: 5, assignee_name: 'Ada', assignee_email: 'A@B.com', role: 'employee', is_active: 1, team: 'English' }];
      }
      if (compact.includes('AS stage_id')) {
        return [{ stage_id: 9, stage_name: 'Subject Matter Development', stage_order: 1, is_active: 1 }];
      }
      if (compact.includes('total_hierarchy_nodes')) {
        return [{ project_id: 58, project_name: 'English', total_tasks: 1, total_remarks: 1, total_hierarchy_nodes: 4, last_updated_at: '2026-02-01T00:00:00Z' }];
      }
      if (compact.includes('AS node_id') || compact.includes('tag_level')) {
        return [{
          node_id: 'g_1', tag_level: 'grade', parent_node_id: null, hierarchy_path: 'Grade 1',
          grade: 'Grade 1', grade_description: null, grade_weight: '0.00', sort_order: 1, is_active: 1,
          updated_at: '2026-01-01T00:00:00Z',
        }];
      }
      if (compact.includes('AS event_id')) return [];
      return [];
    },
    async queryFirst(sql, params) {
      const rows = await this.query(sql, params);
      return rows[0] || null;
    },
    async execute() {
      return { affectedRows: 1, insertId: 1 };
    },
  };
}

async function start(options = {}) {
  const logs = [];
  const app = express();
  app.use('/api/v1', buildRouter({
    db: createFakeDb(options),
    rateLimitPerMinute: options.rateLimitPerMinute || 60,
    log: (entry) => logs.push(entry),
    openapiPath: require('path').join(__dirname, '..', '..', 'workflow-powerbi-api.openapi.yaml'),
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  return { server, logs };
}

async function request(server, path, headers = {}) {
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: response.status, headers: response.headers, text, json };
}

test('missing and unknown keys are 401', async () => {
  const { server } = await start();
  try {
    const missing = await request(server, '/api/v1/projects/58/tasks');
    assert.equal(missing.status, 401);
    assert.deepEqual(missing.json, { error: 'unauthorized' });
    const wrong = await request(server, '/api/v1/projects/58/tasks', { 'X-API-Key': 'pbi_wrong' });
    assert.equal(wrong.status, 401);
  } finally {
    server.close();
  }
});

test('revoked key is 401 and another project is 403', async () => {
  const revoked = await start({ revoked: true });
  const other = await start({ projectIds: [1] });
  try {
    const revokedRes = await request(revoked.server, '/api/v1/projects/58/tasks', { 'X-API-Key': RAW_KEY });
    assert.equal(revokedRes.status, 401);
    const forbidden = await request(other.server, '/api/v1/projects/58/tasks', { 'X-API-Key': RAW_KEY });
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.json, { error: 'forbidden' });
  } finally {
    revoked.server.close();
    other.server.close();
  }
});

test('unknown project is 404 and bad page_size is 400', async () => {
  const { server } = await start({ projectIds: [58, 99] });
  try {
    const missing = await request(server, '/api/v1/projects/99/tasks', { 'X-API-Key': RAW_KEY });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.json, { error: 'not_found' });
    const bad = await request(server, '/api/v1/projects/58/tasks?page_size=5001', { 'X-API-Key': RAW_KEY });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, 'invalid_parameter');
    assert.equal(bad.json.field, 'page_size');
    const field = await request(server, '/api/v1/projects/58/tasks?fields=not_a_field', { 'X-API-Key': RAW_KEY });
    assert.equal(field.status, 400);
    assert.equal(field.json.field, 'fields');
  } finally {
    server.close();
  }
});

test('tasks envelope, stable types, and hidden file path', async () => {
  const { server, logs } = await start();
  try {
    const res = await request(server, '/api/v1/projects/58/tasks?page=1&page_size=1000', { 'X-API-Key': RAW_KEY });
    assert.equal(res.status, 200);
    assert.equal(res.json.meta.project_id, 58);
    assert.equal(res.json.meta.page, 1);
    assert.equal(res.json.meta.total_rows, 1);
    assert.equal(res.json.meta.next_page, null);
    const row = res.json.data[0];
    assert.equal(row.task_id, 10);
    assert.equal(row.priority, 'critical');
    assert.equal(row.assignee_id, 'u_5');
    assert.equal(row.assignee_email, 'ada@example.com');
    assert.equal(row.estimated_hours, 8);
    assert.equal(row.hierarchy_node_id, 'g_3');
    assert.equal(row.description, null);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'server_location'), false);
    assert.equal(JSON.stringify(logs).includes(RAW_KEY), false);
    assert.equal(logs[0].key_id, 7);
    assert.equal(logs[0].status_code, 200);
  } finally {
    server.close();
  }
});

test('csv headers and private remarks require admin scope', async () => {
  const { server } = await start();
  const admin = await start({ scope: 'read_admin' });
  try {
    const csv = await request(server, '/api/v1/projects/58/tasks?format=csv', { 'X-API-Key': RAW_KEY });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.equal(csv.headers.get('x-total-rows'), '1');
    assert.match(csv.text.split('\n')[0], /task_id,task_name/);
    assert.equal(csv.text.includes('D:\\secret'), false);
    const denied = await request(server, '/api/v1/projects/58/remarks?include_private=true', { 'X-API-Key': RAW_KEY });
    assert.equal(denied.status, 403);
    const allowed = await request(admin.server, '/api/v1/projects/58/remarks?include_private=true', { 'X-API-Key': RAW_KEY });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.json.data[0].remark_text, 'Hello');
    assert.equal(Object.prototype.hasOwnProperty.call(allowed.json.data[0], 'remark_html'), false);
  } finally {
    server.close();
    admin.server.close();
  }
});

test('rate limit returns 429 and Retry-After', async () => {
  const { server } = await start({ rateLimitPerMinute: 1 });
  try {
    const first = await request(server, '/api/v1/projects/58/meta', { 'X-API-Key': RAW_KEY });
    assert.equal(first.status, 200);
    assert.equal(first.json.data[0].project_name, 'English');
    const second = await request(server, '/api/v1/projects/58/meta', { 'X-API-Key': RAW_KEY });
    assert.equal(second.status, 429);
    assert.deepEqual(second.json, { error: 'rate_limited' });
    assert.ok(Number(second.headers.get('retry-after')) >= 1);
  } finally {
    server.close();
  }
});

test('history and stages return the list envelope', async () => {
  const { server } = await start();
  try {
    const history = await request(server, '/api/v1/projects/58/task-history', { 'X-API-Key': RAW_KEY });
    assert.equal(history.status, 200);
    assert.deepEqual(history.json.data, []);
    assert.equal(history.json.meta.total_rows, 1);
    const stages = await request(server, '/api/v1/projects/58/stages', { 'X-API-Key': RAW_KEY });
    assert.equal(stages.json.data[0].stage_name, 'Subject Matter Development');
    assert.equal(stages.json.data[0].stage_order, 1);
  } finally {
    server.close();
  }
});
