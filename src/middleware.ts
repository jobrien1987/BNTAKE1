import { NextResponse, type NextRequest } from 'next/server';

// Duplicated from @/server/auth/session on purpose: that module is marked
// server-only and pulls in Prisma, neither of which can load in the edge
// runtime. Keep this string in sync with SESSION_COOKIE there.
const SESSION_COOKIE = 'bn_session';

/**
 * Edge middleware handles two things only: security headers, and a cheap
 * signed-out redirect for private areas.
 *
 * It deliberately does NOT decide authorization. The session cookie is an
 * opaque token that must be looked up in Postgres, which is not available on
 * the edge, so every protected page and action re-checks the real role on the
 * server. Treat this as a fast path that saves a render, never as the gate.
 */

const PRIVATE_PREFIXES = ['/account', '/creator', '/admin'];
const NO_INDEX_PREFIXES = ['/account', '/creator', '/admin', '/cart', '/checkout', '/api'];

const CSP = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts, and `unsafe-eval` is required by
  // the dev overlay only; both are scoped to script-src.
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // Signed-out visitors to a private area are bounced to sign-in before the
  // page renders. Signed-in visitors still get their role checked server-side.
  if (isPrivate && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?returnTo=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }

  // Layouts read this to know the current path (headers() is available in
  // server components; the pathname itself is not).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  if (NO_INDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|uploads).*)',
  ],
};
