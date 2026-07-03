import { formatDateIST, parseApiDateTime } from './dateTimeIST';

export function formatTimeAgo(dateString: string): string {
  const date = parseApiDateTime(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const diffInMs = Date.now() - date.getTime();

  if (diffInMs < 0) return 'Just now';

  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  return formatDateIST(dateString);
}
