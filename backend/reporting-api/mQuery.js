function publicBaseUrl() {
  const base = process.env.PUBLIC_API_BASE_URL || 'https://workflow.company.com/api';
  return String(base).replace(/\/+$/, '');
}

function buildTasksUrl({ projectIds, fields, filters }) {
  const params = new URLSearchParams();
  if (projectIds === 'all' || (Array.isArray(projectIds) && projectIds[0] === 'all')) {
    params.set('projectIds', 'all');
  } else if (Array.isArray(projectIds) && projectIds.length) {
    params.set('projectIds', projectIds.join(','));
  }
  if (fields && fields.length) params.set('fields', fields.join(','));
  if (filters?.status) params.set('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status);
  if (filters?.assigneeIds) params.set('assigneeIds', Array.isArray(filters.assigneeIds) ? filters.assigneeIds.join(',') : filters.assigneeIds);
  if (filters?.grades) params.set('grades', Array.isArray(filters.grades) ? filters.grades.join(',') : filters.grades);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  const qs = params.toString();
  return `${publicBaseUrl()}/reporting/tasks${qs ? `?${qs}` : ''}`;
}

function buildCurl({ projectIds, fields, filters, apiKeyPlaceholder = 'YOUR_API_KEY' }) {
  const url = buildTasksUrl({ projectIds, fields, filters });
  return [
    'curl -sS \\',
    `  -H "X-API-Key: ${apiKeyPlaceholder}" \\`,
    `  -H "Accept: application/json" \\`,
    `  "${url}"`,
  ].join('\n');
}

function buildPowerQueryM({ projectIds, fields, filters, apiKeyPlaceholder = 'YOUR_API_KEY' }) {
  const base = publicBaseUrl();
  const queryEntries = [];
  if (projectIds === 'all' || (Array.isArray(projectIds) && projectIds[0] === 'all')) {
    queryEntries.push('projectIds = "all"');
  } else if (Array.isArray(projectIds) && projectIds.length) {
    queryEntries.push(`projectIds = "${projectIds.join(',')}"`);
  }
  if (fields && fields.length) {
    queryEntries.push(`fields = "${fields.join(',')}"`);
  }
  if (filters?.status) {
    const status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
    queryEntries.push(`status = "${status}"`);
  }
  if (filters?.fromDate) queryEntries.push(`fromDate = "${filters.fromDate}"`);
  if (filters?.toDate) queryEntries.push(`toDate = "${filters.toDate}"`);

  const queryRecord = queryEntries.length
    ? `Query = [${queryEntries.join(', ')}],`
    : 'Query = [],';

  const fieldList = (fields && fields.length)
    ? fields.map((f) => `"${f}"`).join(', ')
    : '"projectId", "projectName", "taskId", "taskName", "status", "assignee", "dueDate", "actualCompletionDate", "delayDays", "overdueFlag"';

  return `let
  BaseUrl = "${base}/",
  ApiKey = "${apiKeyPlaceholder}",
  Source = Json.Document(Web.Contents(BaseUrl, [
    RelativePath = "reporting/tasks",
    ${queryRecord}
    Headers = [#"X-API-Key" = ApiKey]
  ])),
  Rows = Source[data],
  AsTable = Table.FromList(Rows, Splitter.SplitByNothing(), {"Row"}),
  Expanded = Table.ExpandRecordColumn(AsTable, "Row", {${fieldList}})
in
  Expanded`;
}

module.exports = {
  publicBaseUrl,
  buildTasksUrl,
  buildCurl,
  buildPowerQueryM,
};
