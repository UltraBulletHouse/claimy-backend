import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import CaseModel, { CaseDocument } from '@/api/models/Case';
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
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, X-Firebase-Authorization, X-Firebase-Token'
  );
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

type PlainCase = ReturnType<CaseDocument['toObject']> | any;

function mapCase(doc: CaseDocument): Record<string, unknown> {
  const plain: PlainCase = typeof doc.toObject === 'function' ? doc.toObject({ depopulate: true }) : doc;

  const imagesArray: string[] | undefined = Array.isArray(plain.images)
    ? plain.images.filter((item: unknown): item is string => typeof item === 'string')
    : undefined;

  const productImageFromArray =
    imagesArray?.find((url) => url.toLowerCase().includes('product')) ?? imagesArray?.[0];
  const receiptImageFromArray =
    imagesArray?.find((url) => url.toLowerCase().includes('receipt')) ??
    (imagesArray && imagesArray.length > 1 ? imagesArray[1] : undefined);

  const productImageUrl =
    plain.imageUrls?.product ?? plain.productImageUrl ?? productImageFromArray ?? undefined;
  const receiptImageUrl =
    plain.imageUrls?.receipt ?? plain.receiptImageUrl ?? receiptImageFromArray ?? undefined;

  return {
    _id: plain._id?.toString() ?? doc._id.toString(),
    userId: plain.userId ?? undefined,
    userName: plain.userName ?? undefined,
    userEmail: plain.userEmail ?? undefined,
    storeName: plain.storeName ?? plain.store ?? undefined,
    productName: plain.productName ?? plain.product ?? undefined,
    store: plain.store ?? plain.storeName ?? undefined,
    product: plain.product ?? plain.productName ?? undefined,
    description: plain.description ?? undefined,
    createdAt: toIsoString(plain.createdAt ?? doc.createdAt),
    productImageUrl,
    receiptImageUrl,
    images: imagesArray,
    imageUrls:
      productImageUrl || receiptImageUrl
        ? {
            product: productImageUrl,
            receipt: receiptImageUrl,
          }
        : undefined,
    cloudinaryPublicIds: plain.cloudinaryPublicIds ?? undefined,
    manualAnalysis: plain.manualAnalysis
      ? {
          text: plain.manualAnalysis.text,
          updatedAt: toIsoString(plain.manualAnalysis.updatedAt),
        }
      : undefined,
    emails: Array.isArray(plain.emails)
      ? plain.emails.map((email: any) => ({
          subject: email.subject,
          body: email.body,
          to: email.to,
          from: email.from,
          sentAt: toIsoString(email.sentAt),
          threadId: email.threadId ?? undefined,
          messageId: email.messageId ?? undefined,
          references: email.references ?? undefined,
        }))
      : [],
    resolution: plain.resolution
      ? {
          code: plain.resolution.code ?? undefined,
          addedAt: toIsoString(plain.resolution.addedAt),
        }
      : undefined,
    status: plain.status,
    statusHistory: Array.isArray(plain.statusHistory)
      ? plain.statusHistory.map((entry: any) => ({
          status: entry.status,
          by: entry.by,
          at: toIsoString(entry.at),
          note: entry.note ?? undefined,
        }))
      : undefined,
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    await assertAdmin(req);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const query = searchParams.get('q') ?? searchParams.get('search') ?? undefined;
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 200);
    const skip = parsePositiveInt(searchParams.get('skip'), 0, 10_000);

    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }
    if (query) {
      const regex = new RegExp(query, 'i');
      filter.$or = [
        { store: regex },
        { product: regex },
        { description: regex },
        { userEmail: regex },
      ];
    }

    const [items, total] = await Promise.all([
      CaseModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CaseModel.countDocuments(filter),
    ]);

    const mapped = items.map(mapCase);

    return NextResponse.json(
      {
        items: mapped,
        total,
        limit,
        skip,
      },
      { headers }
    );
  } catch (error: any) {
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
    console.error('[admin/cases] GET failed', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
