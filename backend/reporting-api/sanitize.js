/**
 * Strip infrastructure leakage from reporting outputs (Spec §11).
 * Never return UNC paths, drive letters, internal IPs, hostnames, or storage paths.
 */

const UNC = /\\\\[^\s\\/]+(?:\\[^\s]*)?/g;
const DRIVE = /\b[A-Za-z]:\\[^\s]*/g;
const UNIX_VOL = /\/(?:volume\d+|mnt|var\/lib\/docker|data\/nas)[^\s]*/gi;
const IPV4 = /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|127(?:\.\d{1,3}){3})\b/g;
const IPV6_LOCAL = /\b(?:::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)[0-9a-f:]*\b/gi;
const INTERNAL_URL = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.(?:local|internal|lan|corp))(?::\d+)?[^\s]*/gi;
const HOSTNAME = /\b(?:nas\d+|fileserver|srv[-_]?\w+|db[-_]?\w+)\.[a-z0-9.-]+\b/gi;

const REDACTED = '[redacted]';

function sanitizeString(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  let out = value;
  out = out.replace(UNC, REDACTED);
  out = out.replace(DRIVE, REDACTED);
  out = out.replace(UNIX_VOL, REDACTED);
  out = out.replace(INTERNAL_URL, REDACTED);
  out = out.replace(IPV4, REDACTED);
  out = out.replace(IPV6_LOCAL, REDACTED);
  out = out.replace(HOSTNAME, REDACTED);
  return out;
}

function sanitizeValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return value;
}

/** Drop path-like attachment fields entirely; keep safe metadata. */
function sanitizeAttachmentRecord(row) {
  return {
    taskId: row.taskId ?? null,
    fileName: sanitizeString(row.fileName || null),
    fileType: row.fileType ?? null,
    fileSize: row.fileSize ?? null,
    hasFile: Boolean(row.fileName),
  };
}

module.exports = {
  REDACTED,
  sanitizeString,
  sanitizeValue,
  sanitizeAttachmentRecord,
};
