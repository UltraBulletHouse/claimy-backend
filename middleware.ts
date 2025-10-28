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
  const allowed = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['*'];
  const allowAll = allowed.includes('*');
  const allowOrigin = allowAll ? '*' : (allowed.includes(origin) ? origin : '');

  if (allowOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  }
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
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
