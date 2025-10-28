import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function resolveAllowedOrigins(origin: string | null): string | null {
  const envOrigins =
    process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  const defaults = ['*', 'https://claimy-admin.vercel.app', 'http://localhost:3000'];
  const allowed = Array.from(new Set([...envOrigins, ...defaults]));
  const allowAll = allowed.includes('*');
  if (allowAll || !origin) {
    return '*';
  }
  return allowed.includes(origin) ? origin : null;
}

function collectAllowedHeaders(requestHeaders: Headers): string {
  const baseHeaders = [
    'authorization',
    'content-type',
    'accept',
    'x-firebase-authorization',
    'x-firebase-token',
    'x-admin-token',
  ];
  const allowed = new Set(baseHeaders.map((header) => header.toLowerCase()));
  const requested = requestHeaders.get('access-control-request-headers');
  if (requested) {
    requested
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .forEach((header) => allowed.add(header));
  }
  return Array.from(allowed).join(', ');
}

// Apply CORS to API routes
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  const origin = requestHeaders.get('origin');
  const res = NextResponse.next();

  const allowOrigin = resolveAllowedOrigins(origin);
  if (allowOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  }
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', collectAllowedHeaders(requestHeaders));
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
