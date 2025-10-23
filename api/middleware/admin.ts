import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '../lib/firebaseAdmin';

export async function assertAdmin(req: NextRequest): Promise<{ email: string }> {
  const adminToken = req.headers.get('authorization')?.split(' ')[1] || req.headers.get('x-admin-token') || '';
  const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

  if (!ADMIN_SECRET_TOKEN || !ADMIN_EMAIL) {
    throw new Response(JSON.stringify({ error: 'Admin not configured' }), { status: 500 });
  }

  if (adminToken !== ADMIN_SECRET_TOKEN) {
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

  return { email: user.email || '' };
}
