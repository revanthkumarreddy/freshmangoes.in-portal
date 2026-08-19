/**
 * Minimal HTML sanitizer for Wix product descriptions.
 * Strips scripts, event handlers, javascript: URLs, and dangerous tags.
 */
const BLOCKED_TAGS = /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|svg|math|style)[^>]*>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /\s+(?:href|src|xlink:href|action)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;
const DATA_URLS = /\s+src\s*=\s*(?:"\s*data:text\/html[^"]*"|'\s*data:text\/html[^']*')/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(BLOCKED_TAGS, '')
    .replace(EVENT_ATTRS, '')
    .replace(JS_URLS, '')
    .replace(DATA_URLS, '')
    .replace(/<\/?[^>]+(>|$)/g, (tag) => {
      // Drop tags with remaining javascript: or data: handlers
      if (/javascript:|data:text\/html/i.test(tag)) return '';
      return tag;
    });
}

/** Plain text only — safest for truncated blurbs */
export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Same-origin relative path only — blocks open redirects */
export function safeInternalPath(path: string, fallback: string): string {
  try {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
    if (/[\r\n\\]/.test(path)) return fallback;
    if (path.includes('://')) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

export function sanitizeCoupon(code: string): string {
  return (code || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40).toUpperCase();
}
