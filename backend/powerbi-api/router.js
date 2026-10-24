const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const db = require('../db');
const { createAuth, assertProject } = require('./auth');
const { createRateLimiter } = require('./rateLimit');
const { ApiError } = require('./errors');
const { toCsv } = require('./csv');
const { outputColumns } = require('./fields');
const {
  listQuery,
  parseStatus,
  parseAssigneeId,
  parseDateParam,
  parseIncludePrivate,
  parseTagLevel,
  parseProjectId,
  parsePriorityFilter,
} = require('./validate');
const {
  serializeTask,
  serializeRemark,
  serializeAssignee,
  serializeHierarchy,
  serializeHistory,
  serializeStage,
  projectRow,
  isoTimestamp,
} = require('./serializers');
const queries = require('./queries');

function exposeFilePaths() {
  return String(process.env.EXPOSE_FILE_PATHS || '').toLowerCase() === 'true';
}

function envelope(projectId, page, pageSize, total, data) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    meta: {
      project_id: projectId,
      generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      page,
      page_size: pageSize,
      total_rows: total,
      total_pages: totalPages,
      next_page: page < totalPages ? page + 1 : null,
    },
    data,
  };
}

function sendList(res, projectId, paging, columns, rows) {
  const totalPages = paging.total === 0 ? 0 : Math.ceil(paging.total / paging.pageSize);
  const nextPage = paging.page < totalPages ? paging.page + 1 : null;
  res.locals.rowCount = rows.length;
  if (paging.format === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('X-Total-Rows', String(paging.total));
    res.set('X-Page', String(paging.page));
    res.set('X-Page-Size', String(paging.pageSize));
    res.set('X-Total-Pages', String(totalPages));
    res.set('X-Next-Page', nextPage == null ? '' : String(nextPage));
    return res.send(toCsv(columns, rows));
  }
  return res.json(envelope(projectId, paging.page, paging.pageSize, paging.total, rows));
}

function buildRouter(options = {}) {
  const database = options.db || db;
  const requireKey = options.auth || createAuth(database);
  const limiter = options.rateLimiter || createRateLimiter({
    limit: options.rateLimitPerMinute,
  });
  const writeLog = options.log || ((entry) => logger.info('powerbi_request', entry));
  const openapiPath = options.openapiPath || path.join(__dirname, '..', '..', 'workflow-powerbi-api.openapi.yaml');

  const router = express.Router();

  router.use((req, res, next) => {
    res.on('finish', () => {
      writeLog({
        key_id: req.powerbiKey ? req.powerbiKey.id : null,
        endpoint: req.originalUrl.split('?')[0],
        timestamp: new Date().toISOString(),
        row_count: res.locals.rowCount == null ? null : res.locals.rowCount,
        status_code: res.statusCode,
      });
    });
    next();
  });

  router.get('/openapi.yaml', (req, res) => {
    res.type('text/yaml');
    res.send(fs.readFileSync(openapiPath, 'utf8'));
  });

  if (process.env.NODE_ENV !== 'production') {
    router.get('/docs', (req, res) => {
      res.type('text/plain').send('OpenAPI document: /api/v1/openapi.yaml');
    });
  }

  const data = express.Router({ mergeParams: true });
  data.use(requireKey);
  data.use(limiter.middleware);

  async function loadProject(req) {
    const projectId = parseProjectId(req.params.project_id);
    assertProject(req, projectId);
    const project = await queries.projectExists(database, projectId);
    if (!project) {
      const error = new ApiError(404, 'not_found');
      throw error;
    }
    return projectId;
  }

  data.get('/tasks', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const paging = listQuery(req.query, 'tasks');
      const filters = {
        status: parseStatus(req.query),
        stage: req.query.stage ? String(req.query.stage) : null,
        priority: parsePriorityFilter(req.query),
        assigneeId: parseAssigneeId(req.query),
        dueFrom: parseDateParam(req.query, 'due_from'),
        dueTo: parseDateParam(req.query, 'due_to'),
        updatedSince: paging.updatedSince,
      };
      const { total, rows } = await queries.queryTasks(database, projectId, filters, paging.page, paging.pageSize);
      const columns = outputColumns('tasks', exposeFilePaths(), paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeTask(row), columns));
      return sendList(res, projectId, { ...paging, total }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/remarks', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const includePrivate = parseIncludePrivate(req.query);
      if (includePrivate && req.powerbiKey.scope !== 'read_admin') {
        throw new ApiError(403, 'forbidden');
      }
      const paging = listQuery(req.query, 'remarks');
      const { total, rows } = await queries.queryRemarks(database, projectId, {
        includePrivate,
        assigneeId: parseAssigneeId(req.query),
        updatedSince: paging.updatedSince,
      }, paging.page, paging.pageSize);
      const columns = outputColumns('remarks', exposeFilePaths(), paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeRemark(row), columns));
      return sendList(res, projectId, { ...paging, total }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/assignees', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const paging = listQuery(req.query, 'assignees');
      const rows = await queries.queryAssignees(database, projectId);
      const columns = outputColumns('assignees', exposeFilePaths(), paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeAssignee(row), columns));
      return sendList(res, projectId, { ...paging, page: 1, pageSize: dataRows.length || paging.pageSize, total: dataRows.length }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/hierarchy', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const paging = listQuery(req.query, 'hierarchy');
      const { total, rows } = await queries.queryHierarchy(database, projectId, {
        tagLevel: parseTagLevel(req.query),
        updatedSince: paging.updatedSince,
      }, paging.page, paging.pageSize);
      const columns = outputColumns('hierarchy', exposeFilePaths(), paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeHierarchy(row), columns));
      return sendList(res, projectId, { ...paging, total }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/task-history', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const paging = listQuery(req.query, 'history');
      const { total, rows } = await queries.queryHistory(database, projectId, {
        updatedSince: paging.updatedSince,
      }, paging.page, paging.pageSize);
      const columns = outputColumns('history', exposeFilePaths(), paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeHistory(row), columns));
      return sendList(res, projectId, { ...paging, total }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/stages', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const paging = listQuery(req.query, 'stages');
      const rows = await queries.queryStages(database, projectId);
      const columns = outputColumns('stages', false, paging.fields);
      const dataRows = rows.map((row) => projectRow(serializeStage(row), columns));
      return sendList(res, projectId, { ...paging, page: 1, pageSize: dataRows.length || 1, total: dataRows.length }, columns, dataRows);
    } catch (error) {
      return next(error);
    }
  });

  data.get('/meta', async (req, res, next) => {
    try {
      const projectId = await loadProject(req);
      const meta = await queries.queryMeta(database, projectId);
      const generated = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const record = {
        project_id: projectId,
        project_name: meta.project_name,
        exported_at: generated,
        total_hierarchy_nodes: Number(meta.total_hierarchy_nodes || 0),
        total_tasks: Number(meta.total_tasks || 0),
        total_remarks: Number(meta.total_remarks || 0),
        last_updated_at: isoTimestamp(meta.last_updated_at),
      };
      res.locals.rowCount = 1;
      return res.json(envelope(projectId, 1, 1, 1, [record]));
    } catch (error) {
      return next(error);
    }
  });

  router.use('/projects/:project_id', data);

  router.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError) {
      const body = { error: error.error };
      if (error.field) body.field = error.field;
      return res.status(error.status).json(body);
    }
    console.error('powerbi api error:', error.message);
    const status = error.code === 'ECONNREFUSED' ? 503 : 500;
    return res.status(status).json({ error: 'server_error' });
  });

  return router;
}

module.exports = buildRouter();
module.exports.buildRouter = buildRouter;
