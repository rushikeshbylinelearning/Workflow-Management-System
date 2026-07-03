export const REMARK_MAX_PLAIN_LENGTH = 5000;

export function getRemarkPlainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

export function isRemarkTooLong(html: string): boolean {
  return getRemarkPlainTextLength(html) > REMARK_MAX_PLAIN_LENGTH;
}

export function getRemarkLengthMessage(html: string): string | null {
  const length = getRemarkPlainTextLength(html);
  if (length > REMARK_MAX_PLAIN_LENGTH) {
    return `Remark is too long (${length.toLocaleString()} / ${REMARK_MAX_PLAIN_LENGTH.toLocaleString()} characters). Please shorten your text.`;
  }
  return null;
}
