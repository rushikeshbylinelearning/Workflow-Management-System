const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body.toLowerCase())
      ? NAMED[body.toLowerCase()]
      : entity;
  });
}

function htmlToText(html) {
  if (html == null) return null;
  let text = String(html);
  if (!text.trim()) return null;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|tr|h[1-6]|li|ul|ol)>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text).replace(/\u00a0/g, ' ');
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.length ? text : null;
}

function sectionBody(text, label) {
  const match = text.match(new RegExp(
    `(?:^|\\n)\\s*${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:Completed|Pending)\\s*:|$)`,
    'i'
  ));
  return match ? match[1] : null;
}

function countListItems(body) {
  if (body == null) return null;
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return 0;
  const bullets = lines.filter((line) => /^([-*\u2022]|\d+[.)])\s+\S/.test(line));
  if (bullets.length > 0) return bullets.length;
  return lines.length;
}

function remarkListCounts(plainText) {
  if (!plainText) return { completed_items_count: null, pending_items_count: null };
  const completed = sectionBody(plainText, 'Completed');
  const pending = sectionBody(plainText, 'Pending');
  return {
    completed_items_count: completed == null ? null : countListItems(completed),
    pending_items_count: pending == null ? null : countListItems(pending),
  };
}

module.exports = { htmlToText, remarkListCounts, decodeEntities };
