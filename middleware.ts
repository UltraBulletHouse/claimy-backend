import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Apply CORS to API routes
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  const origin = requestHeaders.get('origin') || '*';
  const res = NextResponse.next();

  // Read allowed origins from env; default to *
  const envAllowed = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const defaultAllowed = ['https://claimy-admin.vercel.app', 'http://localhost:3000'];
  const allowed = Array.from(new Set([...envAllowed, ...defaultAllowed]));
  const allowAll = allowed.includes('*');
  const allowOrigin = allowAll ? '*' : (origin && allowed.includes(origin) ? origin : '');

  if (allowOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  }
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  // Echo requested headers for maximum compatibility
  const requestedHeaders = requestHeaders.get('access-control-request-headers');
  if (requestedHeaders && requestedHeaders.length > 0) {
    res.headers.set('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    res.headers.set('Access-Control-Allow-Headers', 'content-type, authorization, accept, x-firebase-authorization, x-firebase-token, x-admin-token');
  }
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
