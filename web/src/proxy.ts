import { NextRequest, NextResponse } from 'next/server';

const production = process.env.NODE_ENV === 'production';
const apiUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!production) return NextResponse.next();

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (accessToken && jwtExpiresAfter(accessToken, Date.now() + 10_000)) {
    return NextResponse.next();
  }
  if (!refreshToken) return signInResponse(request);

  try {
    const refreshed = await fetch(`${apiUrl}/platform/auth/refresh`, {
      method: 'POST',
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store'
    });
    if (!refreshed.ok) return signInResponse(request);

    const setCookies = getSetCookies(refreshed.headers);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      'cookie',
      mergeCookieHeader(request.headers.get('cookie') || '', setCookies)
    );
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of setCookies) response.headers.append('set-cookie', cookie);
    return response;
  } catch {
    return NextResponse.next();
  }
}

function jwtExpiresAfter(token: string, threshold: number): boolean {
  try {
    const encoded = token.split('.')[1] || '';
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > threshold;
  } catch {
    return false;
  }
}

function getSetCookies(headers: Headers): string[] {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  return values?.length ? values : [headers.get('set-cookie') || ''].filter(Boolean);
}

function mergeCookieHeader(original: string, setCookies: string[]): string {
  const cookies = new Map<string, string>();
  for (const item of original.split(';')) {
    const [name, ...value] = item.trim().split('=');
    if (name && value.length) cookies.set(name, value.join('='));
  }
  for (const item of setCookies) {
    const [pair] = item.split(';');
    const [name, ...value] = pair.split('=');
    if (name && value.length) cookies.set(name, value.join('='));
  }
  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; ');
}

function signInResponse(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/auth/sign-in', request.url));
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*']
};
