import { parse } from 'cookie';

export function cookieExtractor(request: {
  headers?: { cookie?: string };
}): string | null {
  const header = request.headers?.cookie;
  if (!header) return null;
  return parse(header).access_token || null;
}

export function refreshCookieExtractor(request: {
  headers?: { cookie?: string };
}): string | null {
  const header = request.headers?.cookie;
  if (!header) return null;
  return parse(header).refresh_token || null;
}
