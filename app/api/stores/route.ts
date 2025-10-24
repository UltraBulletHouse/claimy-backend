import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import { getUserFromToken } from '@/api/lib/auth';
import StoreModel from '@/api/models/Store';

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['*'];

function corsHeaders(req: NextRequest): Headers {
  const origin = req.headers.get('origin') || '';
  const headers = new Headers();
  const allowAll = allowedOrigins.includes('*');
  if (allowAll) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers,
      });
    }

    await connectDB();

    const stores = await StoreModel.find().sort({ name: 1 });
    const items = stores.map((store) => store.toJSON());

    return new NextResponse(JSON.stringify({ items, total: items.length }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('GET /api/stores error', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers,
    });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
