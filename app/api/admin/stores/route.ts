import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import StoreModel, { StoreDocument } from '@/api/models/Store';
import { assertAdmin } from '@/api/middleware/admin';

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
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
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Firebase-Authorization, X-Firebase-Token');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function normalizeStoreId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = trimmed.toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let hex = value.trim();
  if (!hex) return null;
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  } else if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  if (hex.length !== 6 && hex.length !== 8) {
    return null;
  }
  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return `#${hex.toUpperCase()}`;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function serializeStore(store: StoreDocument) {
  const json = store.toJSON();
  json.secondaryColor = store.secondaryColor ?? null;
  return json;
}

export async function GET(req: NextRequest) {
  try {
    const headers = corsHeaders(req);
    await assertAdmin(req);
    await connectDB();

    const stores = await StoreModel.find().sort({ name: 1 });
    const items = stores.map(serializeStore);

    return NextResponse.json({ items, total: items.length }, { headers });
  } catch (error: any) {
    const headers = corsHeaders(req);
    if (error instanceof Response) {
      let body = '';
      try {
        body = await error.text();
      } catch (_) {
        body = JSON.stringify({ error: 'Forbidden' });
      }
      headers.set('Content-Type', 'application/json');
      return new NextResponse(body, { status: error.status, headers });
    }
    console.error('[admin/stores] GET failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headers = corsHeaders(req);
    await assertAdmin(req);

    const payload = await req.json().catch(() => null as unknown);
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    const storeId = normalizeStoreId((payload as any).storeId);
    const name = normalizeName((payload as any).name);
    const primaryColor = normalizeColor((payload as any).primaryColor);
    const secondaryColor = normalizeColor((payload as any).secondaryColor);
    const email = normalizeEmail((payload as any).email);

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required and must use only lowercase letters, numbers, underscores or hyphens.' },
        { status: 400, headers }
      );
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400, headers });
    }
    if (!primaryColor) {
      return NextResponse.json(
        { error: 'Primary color must be a hex value (for example #FFAA00).' },
        { status: 400, headers }
      );
    }
    if (!secondaryColor) {
      return NextResponse.json(
        { error: 'Secondary color must be a hex value (for example #FFAA00).' },
        { status: 400, headers }
      );
    }
    if (!email) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400, headers });
    }

    await connectDB();

    const existing = await StoreModel.findOne({ storeId }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Store ID already exists.' }, { status: 409, headers });
    }

    const created = await StoreModel.create({
      storeId,
      name,
      primaryColor,
      secondaryColor,
      email
    });

    return NextResponse.json(serializeStore(created), { status: 201, headers });
  } catch (error: any) {
    const headers = corsHeaders(req);
    if (error instanceof Response) {
      let body = '';
      try {
        body = await error.text();
      } catch (_) {
        body = JSON.stringify({ error: 'Forbidden' });
      }
      headers.set('Content-Type', 'application/json');
      return new NextResponse(body, { status: error.status, headers });
    }
    console.error('[admin/stores] POST failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
