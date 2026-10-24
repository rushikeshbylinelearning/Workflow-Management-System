class ReportingError extends Error {
  constructor(status, code, message, extras = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extras = extras;
  }
}

function sendError(res, err, correlationId) {
  const status = err.status || 500;
  const body = {
    error: err.code || (status >= 500 ? 'server_error' : 'request_error'),
    message: status >= 500 ? 'An error occurred' : (err.message || 'Request failed'),
  };
  if (err.extras && err.extras.invalidFields) {
    body.invalidFields = err.extras.invalidFields;
  }
  if (correlationId) {
    res.setHeader('X-Correlation-Id', correlationId);
  }
  return res.status(status).json(body);
}

module.exports = { ReportingError, sendError };
