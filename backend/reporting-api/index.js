const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { createAuth, assertFieldGroups } = require('./auth');
const { createRateLimiter } = require('./rateLimit');
const { parseListQuery, resolveProjectIds } = require('./validate');
const { fieldMap, metadataFields, DEFAULT_FIELD_GROUPS } = require('./fields');
const { ReportingError, sendError } = require('./errors');
const { writeAudit } = require('./audit');
const { iterateKeyset, writeJsonEnvelope, writeNdjson } = require('./stream');
const queries = require('./queries');
const {
  serializeTask,
  serializeComment,
  serializeHistory,
  serializeAttachment,
} = require('./serializers');
const { sanitizeValue } = require('./sanitize');
const { buildCurl, buildPowerQueryM, buildTasksUrl, publicBaseUrl } = require('./mQuery');

function reportingEnabled() {
  return String(process.env.REPORTING_API_ENABLED || 'false').toLowerCase() === 'true';
}

function correlationId(req) {
  return req.headers['x-correlation-id'] || crypto.randomBytes(8).toString('hex');
}

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || null;
}

function featureGate(req, res, next) {
  if (!reportingEnabled()) {
    return res.status(404).json({ error: 'not_found', message: 'Not found' });
  }
  return next();
}

function ensureFieldsAllowed(key, resource, fieldNames) {
  const map = fieldMap(resource);
  const defs = fieldNames.map((name) => map.get(name)).filter(Boolean);
  assertFieldGroups(key, defs);
}

async function streamResource(req, res, {
  resource,
  fetchBatch,
  serialize,
  input,
}) {
  const started = Date.now();
  const cid = correlationId(req);
  let rowCount = 0;
  let statusCode = 200;
  let parsed;
  try {
    parsed = parseListQuery(input, resource, req.reportingKey);
    ensureFieldsAllowed(req.reportingKey, resource, parsed.fields);

    // Raise socket timeout for this long-running stream only
    req.setTimeout(0);
    res.setTimeout(0);
    if (req.socket) req.socket.setTimeout(0);

    const iterate = iterateKeyset(
      (cursor, batchSize) => fetchBatch(db, parsed.projectScope, parsed.filters, cursor, batchSize),
      (row) => serialize(row, parsed.fields)
    );

    const metaBase = {
      projectIds: parsed.projectScope.mode === 'all' ? ['all'] : parsed.projectScope.ids,
      fields: parsed.fields,
    };

    const writer = parsed.format === 'ndjson' ? writeNdjson : writeJsonEnvelope;
    rowCount = await writer(res, { iterate, metaBase, correlationId: cid });
  } catch (err) {
    statusCode = err.status || 500;
    if (!res.headersSent) {
      sendError(res, err instanceof ReportingError ? err : new ReportingError(500, 'server_error', 'An error occurred'), cid);
    } else {
      try { res.end(); } catch { /* ignore */ }
    }
  } finally {
    await writeAudit(db, {
      keyId: req.reportingKey?.id,
      endpoint: req.originalUrl.split('?')[0],
      projectIds: parsed?.projectScope?.ids || [],
      fields: parsed?.fields || [],
      filters: parsed?.filters || {},
      rowCount,
      durationMs: Date.now() - started,
      statusCode,
      ip: clientIp(req),
    });
  }
}

function createRouter() {
  const router = express.Router();
  const requireKey = createAuth(db);
  const { middleware: rateLimit } = createRateLimiter();

  router.use(featureGate);

  // Metadata + reporting extracts share auth
  router.use(requireKey);
  router.use(rateLimit);

  router.get('/reporting/tasks', async (req, res) => {
    await streamResource(req, res, {
      resource: 'tasks',
      fetchBatch: queries.fetchTaskBatch,
      serialize: serializeTask,
      input: req.query,
    });
  });

  router.post('/reporting/tasks/query', async (req, res) => {
    await streamResource(req, res, {
      resource: 'tasks',
      fetchBatch: queries.fetchTaskBatch,
      serialize: serializeTask,
      input: { ...req.query, ...(req.body || {}) },
    });
  });

  router.get('/reporting/comments', async (req, res) => {
    await streamResource(req, res, {
      resource: 'comments',
      fetchBatch: queries.fetchCommentBatch,
      serialize: serializeComment,
      input: req.query,
    });
  });

  router.get('/reporting/task-history', async (req, res) => {
    await streamResource(req, res, {
      resource: 'history',
      fetchBatch: queries.fetchHistoryBatch,
      serialize: serializeHistory,
      input: req.query,
    });
  });

  router.get('/reporting/attachments', async (req, res) => {
    await streamResource(req, res, {
      resource: 'attachments',
      fetchBatch: (database, projectScope, _filters, cursor, batchSize) =>
        queries.fetchAttachmentBatch(database, projectScope, cursor, batchSize),
      serialize: serializeAttachment,
      input: req.query,
    });
  });

  router.get('/reporting/projects', async (req, res) => {
    const cid = correlationId(req);
    try {
      const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
      const rows = sanitizeValue(await queries.listProjectsInScope(db, projectScope));
      res.setHeader('X-Correlation-Id', cid);
      res.json({
        data: rows,
        meta: {
          count: rows.length,
          generatedAt: require('./reportingRules').formatIstIsoNow(),
          projectIds: projectScope.mode === 'all' ? ['all'] : projectScope.ids,
          fields: ['projectId', 'projectName', 'status', 'startDate', 'endDate'],
        },
      });
    } catch (err) {
      sendError(res, err instanceof ReportingError ? err : new ReportingError(500, 'server_error', 'An error occurred'), cid);
    }
  });

  router.get('/reporting/users', async (req, res) => {
    const cid = correlationId(req);
    try {
      const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
      const rows = sanitizeValue(await queries.listUsersInScope(db, projectScope));
      const groups = new Set(req.reportingKey.fieldGroups || []);
      const allowEmail = groups.has('assigneeEmail') || groups.has('pii');
      const data = rows.map((row) => {
        const out = { ...row };
        if (!allowEmail) delete out.email;
        return out;
      });
      res.setHeader('X-Correlation-Id', cid);
      res.json({
        data,
        meta: {
          count: data.length,
          generatedAt: require('./reportingRules').formatIstIsoNow(),
          projectIds: projectScope.mode === 'all' ? ['all'] : projectScope.ids,
          fields: Object.keys(data[0] || { userId: 1, name: 1 }),
        },
      });
    } catch (err) {
      sendError(res, err instanceof ReportingError ? err : new ReportingError(500, 'server_error', 'An error occurred'), cid);
    }
  });

  router.get('/reporting/hierarchy', async (req, res) => {
    const cid = correlationId(req);
    try {
      const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
      const data = sanitizeValue(await queries.listHierarchyInScope(db, projectScope));
      res.setHeader('X-Correlation-Id', cid);
      res.json({
        data,
        meta: {
          count: (data.grades?.length || 0) + (data.books?.length || 0) + (data.units?.length || 0) + (data.lessons?.length || 0),
          generatedAt: require('./reportingRules').formatIstIsoNow(),
          projectIds: projectScope.mode === 'all' ? ['all'] : projectScope.ids,
          fields: ['grades', 'books', 'units', 'lessons'],
          note: 'subject/chapter/topic are NOT AVAILABLE in this schema',
        },
      });
    } catch (err) {
      sendError(res, err instanceof ReportingError ? err : new ReportingError(500, 'server_error', 'An error occurred'), cid);
    }
  });

  // Metadata catalogs
  router.get('/metadata/fields', (req, res) => {
    res.json({ data: metadataFields(), meta: { defaultFieldGroups: DEFAULT_FIELD_GROUPS } });
  });

  router.get('/metadata/statuses', async (req, res) => {
    res.json({ data: await queries.metadataStatuses() });
  });

  router.get('/metadata/priorities', async (req, res) => {
    res.json({ data: await queries.metadataPriorities() });
  });

  router.get('/metadata/stages', async (req, res) => {
    const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
    res.json({ data: await queries.metadataStages(db, projectScope) });
  });

  router.get('/metadata/grades', async (req, res) => {
    const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
    res.json({ data: await queries.metadataGrades(db, projectScope) });
  });

  router.get('/metadata/subjects', (req, res) => {
    res.json({ data: [], meta: { available: false, note: 'subjects are NOT AVAILABLE in this schema' } });
  });

  router.get('/metadata/projects', async (req, res) => {
    const projectScope = resolveProjectIds('all', req.reportingKey.projectIds, req.reportingKey.allProjects);
    const rows = await queries.listProjectsInScope(db, projectScope);
    res.json({ data: rows });
  });

  router.get('/metadata/users', async (req, res) => {
    const projectScope = resolveProjectIds(req.query.projectIds || 'all', req.reportingKey.projectIds, req.reportingKey.allProjects);
    const rows = await queries.listUsersInScope(db, projectScope);
    res.json({
      data: rows.map(({ userId, name, role, isActive }) => ({ userId, name, role, isActive })),
    });
  });

  // Helper generators (authenticated) for UI
  router.post('/reporting/generate', (req, res) => {
    const body = req.body || {};
    const projectIds = body.projectIds || 'all';
    const fields = body.fields || [];
    const filters = body.filters || {};
    res.json({
      data: {
        url: buildTasksUrl({ projectIds, fields, filters }),
        curl: buildCurl({ projectIds, fields, filters }),
        mQuery: buildPowerQueryM({ projectIds, fields, filters }),
        baseUrl: publicBaseUrl(),
      },
    });
  });

  return router;
}

module.exports = {
  createRouter,
  reportingEnabled,
  featureGate,
};
