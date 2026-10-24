const { invalid } = require('./errors');
const { knownFields, STATUS_VALUES, PRIORITY_VALUES, TAG_LEVELS } = require('./fields');

function emptyToNull(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function parsePage(query) {
  const page = query.page == null || query.page === '' ? 1 : Number(query.page);
  if (!Number.isInteger(page) || page < 1) throw invalid('page');
  return page;
}

function parsePageSize(query) {
  const pageSize = query.page_size == null || query.page_size === '' ? 1000 : Number(query.page_size);
  if (!Number.isInteger(pageSize) || pageSize < 1) throw invalid('page_size');
  if (pageSize > 5000) throw invalid('page_size');
  return pageSize;
}

function parseFormat(query) {
  const format = query.format == null || query.format === '' ? 'json' : String(query.format);
  if (format !== 'json' && format !== 'csv') throw invalid('format');
  return format;
}

function parseUpdatedSince(query) {
  if (query.updated_since == null || query.updated_since === '') return null;
  const text = String(query.updated_since);
  const date = new Date(text);
  if (Number.isNaN(date.getTime()) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(text)) throw invalid('updated_since');
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseDateParam(query, name) {
  if (query[name] == null || query[name] === '') return null;
  const match = String(query[name]).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw invalid(name);
  return match[1];
}

function parseFields(query, resource) {
  if (query.fields == null || query.fields === '') return null;
  const allowed = new Set(knownFields(resource));
  const fields = String(query.fields).split(',').map((field) => field.trim()).filter(Boolean);
  if (fields.length === 0) throw invalid('fields');
  for (const field of fields) {
    if (!allowed.has(field)) throw invalid('fields');
  }
  return fields;
}

function parseStatus(query) {
  if (query.status == null || query.status === '') return null;
  const values = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
  if (values.length === 0) throw invalid('status');
  for (const value of values) {
    if (!STATUS_VALUES.includes(value)) throw invalid('status');
  }
  return values;
}

function parsePriorityFilter(query) {
  if (query.priority == null || query.priority === '') return null;
  const value = String(query.priority).trim();
  if (!PRIORITY_VALUES.includes(value)) throw invalid('priority');
  return value;
}

function parseAssigneeId(query) {
  if (query.assignee_id == null || query.assignee_id === '') return null;
  const match = String(query.assignee_id).trim().match(/^(?:u_)?(\d+)$/);
  if (!match) throw invalid('assignee_id');
  return Number(match[1]);
}

function parseIncludePrivate(query) {
  if (query.include_private == null || query.include_private === '') return false;
  const value = String(query.include_private).toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw invalid('include_private');
}

function parseTagLevel(query) {
  if (query.tag_level == null || query.tag_level === '') return null;
  const value = String(query.tag_level).trim();
  if (!TAG_LEVELS.includes(value)) throw invalid('tag_level');
  return value;
}

function parseProjectId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw invalid('project_id');
  return id;
}

function listQuery(query, resource) {
  return {
    page: parsePage(query),
    pageSize: parsePageSize(query),
    format: parseFormat(query),
    updatedSince: parseUpdatedSince(query),
    fields: parseFields(query, resource),
  };
}

module.exports = {
  emptyToNull,
  parsePage,
  parsePageSize,
  parseFormat,
  parseUpdatedSince,
  parseDateParam,
  parseFields,
  parseStatus,
  parsePriorityFilter,
  parseAssigneeId,
  parseIncludePrivate,
  parseTagLevel,
  parseProjectId,
  listQuery,
};
