import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import StoreModel from '@/api/models/Store';
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
  headers.set('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, X-Firebase-Authorization, X-Firebase-Token'
  );
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const headers = corsHeaders(req);
    await assertAdmin(req);

    const originalId = params.storeId;
    if (!originalId) {
      return NextResponse.json({ error: 'Store ID missing in path.' }, { status: 400, headers });
    }

    const payload = await req.json().catch(() => null as unknown);
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    const nextStoreId = normalizeStoreId((payload as any).storeId) ?? undefined;
    const name = normalizeName((payload as any).name);
    const primaryColorValue = (payload as any).primaryColor;
    const email = normalizeEmail((payload as any).email) ?? undefined;

    const update: Record<string, unknown> = {};

    if (typeof (payload as any).name !== 'undefined') {
      if (!name) {
        return NextResponse.json({ error: 'Name is required.' }, { status: 400, headers });
      }
      update.name = name;
    }

    if (typeof primaryColorValue !== 'undefined') {
      const normalizedColor = normalizeColor(primaryColorValue);
      if (!normalizedColor) {
        return NextResponse.json(
          { error: 'Primary color must be a hex value (for example #FFAA00).' },
          { status: 400, headers }
        );
      }
      update.primaryColor = normalizedColor;
    }

    if (typeof (payload as any).email !== 'undefined') {
      if (!email) {
        return NextResponse.json({ error: 'Valid email is required.' }, { status: 400, headers });
      }
      update.email = email;
    }

    if (typeof (payload as any).storeId !== 'undefined') {
      if (!nextStoreId) {
        return NextResponse.json(
          { error: 'Store ID must use only lowercase letters, numbers, underscores or hyphens.' },
          { status: 400, headers }
        );
      }
      update.storeId = nextStoreId;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400, headers });
    }

    await connectDB();

    const current = await StoreModel.findOne({ storeId: originalId });
    if (!current) {
      return NextResponse.json({ error: 'Store not found.' }, { status: 404, headers });
    }

    if (typeof update.storeId === 'string' && update.storeId !== originalId) {
      const exists = await StoreModel.findOne({ storeId: update.storeId }).lean();
      if (exists) {
        return NextResponse.json({ error: 'Store ID already exists.' }, { status: 409, headers });
      }
    }

    Object.assign(current, update);
    await current.save();

    return NextResponse.json(current.toJSON(), { headers });
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
    console.error('[admin/stores] PUT failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
