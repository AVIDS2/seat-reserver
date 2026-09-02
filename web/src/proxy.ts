import { NextRequest, NextResponse } from 'next/server';

const production = process.env.NODE_ENV === 'production';
const internalApi = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!production) return NextResponse.next();

  const cookie = request.headers.get('cookie') || '';
  const me = await fetch(`${internalApi}/platform/auth/me`, {
    headers: { cookie },
    cache: 'no-store'
  }).catch(() => null);
  if (me?.ok) return NextResponse.next();

  const refresh = await fetch(`${internalApi}/platform/auth/refresh`, {
    method: 'POST',
    headers: { cookie },
    cache: 'no-store'
  }).catch(() => null);
  if (!refresh?.ok) return NextResponse.redirect(new URL('/auth/sign-in', request.url));

  const nextHeaders = new Headers(request.headers);
  const headers = refresh.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() || [refresh.headers.get('set-cookie') || ''];
  const mergedCookies = mergeRequestCookies(cookie, setCookies);
  if (mergedCookies) nextHeaders.set('cookie', mergedCookies);
  const response = NextResponse.next({ request: { headers: nextHeaders } });
  for (const setCookie of setCookies) {
    if (setCookie) response.headers.append('set-cookie', setCookie);
  }
  return response;
}

function mergeRequestCookies(original: string, setCookies: string[]): string {
  const values = new Map<string, string>();
  for (const pair of original.split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name && value.length) values.set(name, value.join('='));
  }
  for (const setCookie of setCookies) {
    const pair = setCookie.split(';', 1)[0];
    const [name, ...value] = pair.split('=');
    if (name && value.length) values.set(name, value.join('='));
  }
  return Array.from(values.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

export const config = {
  matcher: ['/dashboard/:path*']
};
