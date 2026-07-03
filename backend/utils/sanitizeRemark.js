const REMARK_MAX_PLAIN_LENGTH = 5000;
const REMARK_MAX_HTML_LENGTH = 65535;

/**
 * Strip HTML and dangerous content from remark text before persistence/display.
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRemarkText(text, maxLength = REMARK_MAX_PLAIN_LENGTH) {
  const cleaned = stripHtml(text);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength);
}

module.exports = {
  stripHtml,
  sanitizeRemarkText,
  REMARK_MAX_PLAIN_LENGTH,
  REMARK_MAX_HTML_LENGTH,
};
