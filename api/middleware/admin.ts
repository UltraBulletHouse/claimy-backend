import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin';

export async function assertAdmin(req: NextRequest): Promise<{ email: string }> {
  const adminToken = req.headers.get('authorization')?.split(' ')[1] || req.headers.get('x-admin-token') || '';
  const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  //empty push

  if (!ADMIN_SECRET_TOKEN || !ADMIN_EMAIL) {
    throw new Response(JSON.stringify({ error: 'Admin not configured' }), { status: 500 });
  }

  let sessionEmail: string | null = null;

  if (adminToken && adminToken === ADMIN_SECRET_TOKEN) {
    sessionEmail = ADMIN_EMAIL;
  } else if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, ADMIN_SECRET_TOKEN) as jwt.JwtPayload & {
        email?: string;
      };
      if (decoded?.email && decoded.email === ADMIN_EMAIL) {
        sessionEmail = decoded.email;
      } else {
        throw new Error('Invalid admin token email');
      }
    } catch (error) {
      console.warn('Failed to verify admin session token', error);
      throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
  } else {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Verify Firebase user using either standard auth header or x-firebase-authorization
  const fbHeader = req.headers.get('x-firebase-authorization') || req.headers.get('x-firebase-token') || null;
  const user = await verifyFirebaseIdToken(fbHeader);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Invalid Firebase token' }), { status: 401 });
  }

  if (user.email !== ADMIN_EMAIL) {
    throw new Response(JSON.stringify({ error: 'Not admin user' }), { status: 403 });
  }

  return { email: user.email || sessionEmail || '' };
}
