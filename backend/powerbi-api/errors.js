class ApiError extends Error {
  constructor(status, error, field) {
    super(error);
    this.status = status;
    this.error = error;
    this.field = field || null;
  }
}

function invalid(field) {
  return new ApiError(400, 'invalid_parameter', field);
}

function sendError(res, status, error, field) {
  const body = { error };
  if (field) body.field = field;
  if (status === 429) {
    /* Retry-After is set by the caller */
  }
  return res.status(status).json(body);
}

module.exports = { ApiError, invalid, sendError };
