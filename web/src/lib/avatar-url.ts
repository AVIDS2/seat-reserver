export function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('/')) return value;

  try {
    const url = new URL(value);
    if (['api', 'localhost', '127.0.0.1'].includes(url.hostname)) {
      return `${url.pathname}${url.search}`;
    }
    return value;
  } catch {
    return null;
  }
}
