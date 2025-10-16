import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import ComplaintModel from '@/api/models/Complaint';
import { sendComplaintEmail } from '@/api/lib/gmail';

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
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null as unknown);
    if (!body || typeof body !== 'object') {
      return new NextResponse(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders(req) });
    }

    const {
      name,
      email,
      store,
      product,
      description,
      images,
    } = body as Partial<{
      name: string;
      email: string;
      store: string;
      product: string;
      description: string;
      images: string[];
    }>;

    // Basic validation based on existing Flutter form fields
    if (!isNonEmptyString(store)) {
      return new NextResponse(JSON.stringify({ error: 'Store is required' }), { status: 400, headers: corsHeaders(req) });
    }
    if (!isNonEmptyString(product)) {
      return new NextResponse(JSON.stringify({ error: 'Product is required' }), { status: 400, headers: corsHeaders(req) });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers: corsHeaders(req) });
    }

    const normalizedImages = images && isStringArray(images) ? images : [];

    await connectDB();

    const doc = await ComplaintModel.create({
      name: isNonEmptyString(name) ? name.trim() : undefined,
      email: isNonEmptyString(email) ? email.trim().toLowerCase() : undefined,
      store: store.trim(),
      product: product.trim(),
      description: isNonEmptyString(description) ? description.trim() : undefined,
      images: normalizedImages,
    });

    // Prepare email
    const subject = `New complaint from ${name || email || 'anonymous'}: ${product}`;
    const bodyLines = [
      'A new complaint has been submitted:',
      '',
      name ? `Name: ${name}` : undefined,
      email ? `Email: ${email}` : undefined,
      `Store: ${store}`,
      `Product: ${product}`,
      description ? `Description: ${description}` : undefined,
      normalizedImages.length ? `Images: ${normalizedImages.join(', ')}` : undefined,
      '',
      `Created at: ${doc.createdAt.toISOString()}`,
      `ID: ${doc.id}`,
    ].filter(Boolean);

    try {
      await sendComplaintEmail({
        subject,
        body: bodyLines.join('\n'),
      });
    } catch (emailErr) {
      console.error('Failed to send email notification:', emailErr);
      // Continue: we still created the record. Return 207 Multi-Status-like message via payload
      return new NextResponse(JSON.stringify({
        ok: true,
        id: doc.id,
        emailSent: false,
        message: 'Complaint saved, but failed to send email notification.'
      }), { status: 201, headers: corsHeaders(req) });
    }

    return new NextResponse(JSON.stringify({ ok: true, id: doc.id, emailSent: true }), { status: 201, headers: corsHeaders(req) });
  } catch (err) {
    console.error('Unexpected error handling complaint:', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders(req) });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
