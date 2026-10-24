const { ReportingError } = require('./errors');
const { fieldMap, defaultFieldNames, projectIdAlwaysAllowed, STATUS_VALUES } = require('./fields');

function parseCsvInts(raw, name) {
  if (raw == null || raw === '') return null;
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  const ids = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      throw new ReportingError(400, 'invalid_parameter', `Invalid ${name}`, { invalidFields: [name] });
    }
    ids.push(Number(part));
  }
  return ids;
}

function parseCsvStrings(raw) {
  if (raw == null || raw === '') return null;
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseDate(raw, name) {
  if (raw == null || raw === '') return null;
  const match = String(raw).match(/^(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    throw new ReportingError(400, 'invalid_parameter', `Invalid ${name}`, { invalidFields: [name] });
  }
  return match[1];
}

function parseFields(raw, resource) {
  const map = fieldMap(resource);
  if (raw == null || raw === '') {
    return projectIdAlwaysAllowed(defaultFieldNames(resource));
  }
  const requested = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (requested.length === 0) {
    throw new ReportingError(400, 'invalid_parameter', 'fields cannot be empty', { invalidFields: ['fields'] });
  }
  const invalid = [];
  for (const name of requested) {
    // Reject SQL/injection-looking tokens and unknown names
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || !map.has(name)) {
      invalid.push(name);
    }
  }
  if (invalid.length) {
    throw new ReportingError(400, 'invalid_fields', 'Unknown or invalid field names', { invalidFields: invalid });
  }
  return projectIdAlwaysAllowed(requested);
}

/**
 * Resolve projectIds against key scope.
 * @returns {{ mode: 'all'|'list', ids: number[] }}
 */
function resolveProjectIds(raw, keyProjectIds, allProjectsAllowed) {
  const allowed = Array.isArray(keyProjectIds) ? keyProjectIds.map(Number) : [];
  if (raw == null || raw === '' || String(raw).toLowerCase() === 'all') {
    if (allProjectsAllowed || allowed.includes(-1)) {
      return { mode: 'all', ids: [] };
    }
    return { mode: 'list', ids: allowed.slice() }; // ARRAY_COPY
  }
  const requested = parseCsvInts(raw, 'projectIds');
  const denied = requested.filter((id) => !allowed.includes(id) && !allProjectsAllowed);
  if (denied.length) {
    throw new ReportingError(403, 'forbidden', 'Project access denied');
  }
  return { mode: 'list', ids: requested };
}

function parseFormat(raw) {
  if (raw == null || raw === '') return 'json';
  const format = String(raw).toLowerCase();
  if (format !== 'json' && format !== 'ndjson') {
    throw new ReportingError(400, 'invalid_parameter', 'format must be json or ndjson', { invalidFields: ['format'] });
  }
  return format;
}

function parseListQuery(input, resource, key) {
  const src = input || {};
  const fields = parseFields(src.fields, resource);
  const projectScope = resolveProjectIds(src.projectIds, key.projectIds, key.allProjects === true);

  let statuses = parseCsvStrings(src.status);
  if (statuses) {
    for (const status of statuses) {
      if (!STATUS_VALUES.includes(status)) {
        throw new ReportingError(400, 'invalid_parameter', `Invalid status: ${status}`, { invalidFields: ['status'] });
      }
    }
  }

  const assigneeIds = parseCsvInts(src.assigneeIds, 'assigneeIds');
  const grades = parseCsvStrings(src.grades);
  const subjects = parseCsvStrings(src.subjects); // accepted but unused — NOT AVAILABLE
  const fromDate = parseDate(src.fromDate, 'fromDate');
  const toDate = parseDate(src.toDate, 'toDate');
  const format = parseFormat(src.format);

  return {
    fields,
    projectScope,
    filters: {
      statuses,
      assigneeIds,
      grades,
      subjects,
      fromDate,
      toDate,
    },
    format,
  };
}

module.exports = {
  parseCsvInts,
  parseCsvStrings,
  parseDate,
  parseFields,
  resolveProjectIds,
  parseFormat,
  parseListQuery,
};
