import { NextRequest, NextResponse } from 'next/server';

const production = process.env.NODE_ENV === 'production';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!production) return NextResponse.next();

  // The dashboard layout performs the authoritative JWT check. The proxy only
  // rejects requests that have no session at all, avoiding duplicate /me calls
  // and false redirects when the API rate limiter is reached.
  const hasSession = request.cookies.has('access_token') || request.cookies.has('refresh_token');
  if (!hasSession) return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
