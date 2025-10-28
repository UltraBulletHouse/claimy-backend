import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin';
import { getAdminSecretRaw, getAdminSessionSecret } from '../lib/adminSecret';
import { getAdminEmail, matchesAdminEmail } from '../lib/adminConfig';

export async function assertAdmin(req: NextRequest): Promise<{ email: string }> {
  const adminToken = req.headers.get('authorization')?.split(' ')[1] || req.headers.get('x-admin-token') || '';
  //empty push

  let rawSecret: string;
  let sessionSecret: Buffer;
  let adminEmail: string;
  try {
    adminEmail = getAdminEmail();
    rawSecret = getAdminSecretRaw();
    sessionSecret = getAdminSessionSecret();
  } catch (error) {
    console.warn('Failed to load admin admin configuration', error);
    throw new Response(JSON.stringify({ error: 'Admin not configured' }), { status: 500 });
  }

  let sessionEmail: string | null = null;

  if (adminToken && adminToken === rawSecret) {
    sessionEmail = adminEmail;
  } else if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, sessionSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload & {
        email?: string;
      };
      if (decoded?.email && matchesAdminEmail(decoded.email)) {
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

  if (!matchesAdminEmail(user.email)) {
    throw new Response(JSON.stringify({ error: 'Not admin user' }), { status: 403 });
  }

  return { email: user.email || sessionEmail || adminEmail };
}
