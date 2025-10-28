import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import { assertAdmin } from '@/api/middleware/admin';
import { getAdminSessionSecret } from '@/api/lib/adminSecret';
import CaseModel from '@/api/models/Case';
import StoreModel from '@/api/models/Store';
import { updateCaseStatus } from '@/api/lib/caseUtils';
import { sendEmail, fetchThread, listNewMessages } from '@/api/lib/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['*'];

function corsHeaders(req: NextRequest): Headers {
  const origin = req.headers.get('origin') || '';
  const headers = new Headers();
  const allowAll = allowedOrigins.includes('*');
  if (allowAll) headers.set('Access-Control-Allow-Origin', '*');
  else if (origin && allowedOrigins.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Firebase-Authorization, X-Firebase-Token, X-Admin-Token');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function segmentsAfterAdmin(req: NextRequest): string[] {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex(p => p === 'admin');
  return idx >= 0 ? parts.slice(idx + 1) : [];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeStoreId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = trimmed.toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(candidate)) return null;
  return candidate;
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let hex = value.trim();
  if (!hex) return null;
  if (hex.startsWith('#')) hex = hex.slice(1);
  else if (hex.startsWith('0x')) hex = hex.slice(2);
  if (hex.length !== 6 && hex.length !== 8) return null;
  const parsed = Number.parseInt(hex, 16);
  if (Number.isNaN(parsed)) return null;
  return `#${hex.toUpperCase()}`;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function serializeStore(store: any) {
  const json = store.toJSON();
  json.secondaryColor = store.secondaryColor ?? null;
  return json;
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    await assertAdmin(req);
    const seg = segmentsAfterAdmin(req);
    // /admin/cases
    if (seg.length === 1 && seg[0] === 'cases') {
      await connectDB();
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') ?? undefined;
      const query = searchParams.get('q') ?? searchParams.get('search') ?? undefined;
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 200);
      const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10), 0);
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (query) {
        const regex = new RegExp(query, 'i');
        (filter as any).$or = [ { store: regex }, { product: regex }, { description: regex }, { userEmail: regex } ];
      }
      const [items, total] = await Promise.all([
        CaseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        CaseModel.countDocuments(filter),
      ]);
      const mapped = items.map((doc: any) => ({ ...doc.toObject(), _id: doc._id.toString() }));
      return NextResponse.json({ items: mapped, total, limit, skip }, { headers });
    }
    // /admin/cases/:id
    if (seg.length === 2 && seg[0] === 'cases') {
      await connectDB();
      const c = await CaseModel.findById(seg[1]);
      if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
      return NextResponse.json(c, { headers });
    }
    // /admin/cases/:id/thread
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'thread') {
      await connectDB();
      const c = await CaseModel.findById(seg[1]);
      if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
      if (!c.threadId) return NextResponse.json({ error: 'No threadId for case' }, { status: 400, headers });
      const thr = await fetchThread(c.threadId);
      return NextResponse.json(thr, { headers });
    }
    // /admin/stores
    if (seg.length === 1 && seg[0] === 'stores') {
      await connectDB();
      const stores = await StoreModel.find().sort({ name: 1 });
      const items = stores.map(serializeStore);
      return NextResponse.json({ items, total: items.length }, { headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin catch-all] GET failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export async function DELETE(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    await assertAdmin(req);
    const seg = segmentsAfterAdmin(req);
    // /admin/cases/:id
    if (seg.length === 2 && seg[0] === 'cases') {
      await connectDB();
      await CaseModel.findByIdAndDelete(seg[1]);
      return NextResponse.json({ ok: true }, { headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin catch-all] DELETE failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export async function PUT(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    await assertAdmin(req);
    const seg = segmentsAfterAdmin(req);
    // /admin/stores/:storeId
    if (seg.length === 2 && seg[0] === 'stores') {
      const originalId = seg[1];
      const payload = await req.json().catch(() => null as unknown);
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
      }
      const nextStoreId = normalizeStoreId((payload as any).storeId) ?? undefined;
      const name = normalizeName((payload as any).name);
      const primaryColorValue = (payload as any).primaryColor;
      const secondaryColorValue = (payload as any).secondaryColor;
      const email = normalizeEmail((payload as any).email) ?? undefined;
      const update: Record<string, unknown> = {};
      if (typeof (payload as any).name !== 'undefined') {
        if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400, headers });
        update.name = name;
      }
      if (typeof primaryColorValue !== 'undefined') {
        const normalizedColor = normalizeColor(primaryColorValue);
        if (!normalizedColor) return NextResponse.json({ error: 'Primary color must be a hex value.' }, { status: 400, headers });
        update.primaryColor = normalizedColor;
      }
      if (typeof secondaryColorValue !== 'undefined') {
        const normalizedColor = normalizeColor(secondaryColorValue);
        if (!normalizedColor) return NextResponse.json({ error: 'Secondary color must be a hex value.' }, { status: 400, headers });
        update.secondaryColor = normalizedColor;
      }
      if (typeof (payload as any).email !== 'undefined') {
        if (!email) return NextResponse.json({ error: 'Valid email is required.' }, { status: 400, headers });
        update.email = email;
      }
      if (typeof (payload as any).storeId !== 'undefined') {
        if (!nextStoreId) {
          return NextResponse.json({ error: 'Store ID must use lowercase letters, numbers, underscores or hyphens.' }, { status: 400, headers });
        }
        update.storeId = nextStoreId;
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'No changes provided.' }, { status: 400, headers });
      }
      await connectDB();
      const current = await StoreModel.findOne({ storeId: originalId });
      if (!current) return NextResponse.json({ error: 'Store not found.' }, { status: 404, headers });
      if (typeof (update as any).storeId === 'string' && (update as any).storeId !== originalId) {
        const exists = await StoreModel.findOne({ storeId: (update as any).storeId }).lean();
        if (exists) return NextResponse.json({ error: 'Store ID already exists.' }, { status: 409, headers });
      }
      Object.assign(current, update);
      await current.save();
      return NextResponse.json(serializeStore(current), { headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin catch-all] PUT failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const admin = await assertAdmin(req);
    const seg = segmentsAfterAdmin(req);
    // /admin/cases/:id/analysis
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'analysis') {
      const { text } = await req.json();
      if (!isNonEmptyString(text)) return NextResponse.json({ error: 'text required' }, { status: 400, headers });
      await connectDB();
      const updated = await CaseModel.findByIdAndUpdate(seg[1], { manualAnalysis: { text, updatedAt: new Date() } }, { new: true });
      return NextResponse.json(updated, { headers });
    }
    // /admin/cases/:id/approve
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'approve') {
      await connectDB();
      await updateCaseStatus(seg[1], 'APPROVED', undefined, admin.email);
      return NextResponse.json({ ok: true }, { headers });
    }
    // /admin/cases/:id/code
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'code') {
      const { code } = await req.json();
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400, headers });
      await connectDB();
      await CaseModel.findByIdAndUpdate(seg[1], { resolution: { code, addedAt: new Date() } });
      await updateCaseStatus(seg[1], 'APPROVED', 'Resolution code attached', admin.email);
      return NextResponse.json({ ok: true }, { headers });
    }
    // /admin/cases/:id/email/send
    if (seg.length === 4 && seg[0] === 'cases' && seg[2] === 'email' && seg[3] === 'send') {
      await connectDB();
      const payload = await req.json();
      const { subject, body: textBody } = payload || {};
      if (!subject || !textBody) return NextResponse.json({ error: 'subject and body required' }, { status: 400, headers });
      const c = await CaseModel.findById(seg[1]);
      if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
      if (!c.userEmail) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400, headers });
      const to = c.userEmail;
      const result = await sendEmail({ to, subject, body: textBody });
      const emailEntry: any = { subject, body: textBody, to, from: process.env.GMAIL_USER || 'me', sentAt: new Date(), threadId: result.threadId || c.threadId || null };
      c.emails = c.emails || [];
      c.emails.push(emailEntry);
      if (!c.threadId && result.threadId) c.threadId = result.threadId;
      await c.save();
      return NextResponse.json({ ok: true, messageId: result.id, threadId: c.threadId }, { headers });
    }
    // /admin/cases/:id/reject
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'reject') {
      await connectDB();
      await updateCaseStatus(seg[1], 'REJECTED', undefined, admin.email);
      return NextResponse.json({ ok: true }, { headers });
    }
    // /admin/cases/:id/reply
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'reply') {
      await connectDB();
      const payload = await req.json();
      const { body: textBody, subject } = payload || {};
      if (!textBody) return NextResponse.json({ error: 'body required' }, { status: 400, headers });
      const c = await CaseModel.findById(seg[1]);
      if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
      if (!c.userEmail) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400, headers });
      const res = await sendEmail({ to: c.userEmail, subject: subject || 'Re: case update', body: textBody, threadId: c.threadId || undefined });
      c.emails = c.emails || [];
      c.emails.push({ subject: subject || '', body: textBody, to: c.userEmail, from: process.env.GMAIL_USER || 'me', sentAt: new Date(), threadId: res.threadId || c.threadId || undefined } as any);
      if (!c.threadId && res.threadId) c.threadId = res.threadId;
      await c.save();
      return NextResponse.json({ ok: true }, { headers });
    }
    // /admin/cases/:id/request-info
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'request-info') {
      await connectDB();
      const { message } = await req.json();
      if (!isNonEmptyString(message)) return NextResponse.json({ error: 'message required' }, { status: 400, headers });
      const c = await CaseModel.findById(seg[1]);
      if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
      if (!c.userEmail) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400, headers });
      await sendEmail({ to: c.userEmail, subject: 'Need more information for your case', body: message, threadId: c.threadId || undefined });
      await updateCaseStatus(seg[1], 'NEED_INFO', 'Requested more info', admin.email);
      return NextResponse.json({ ok: true }, { headers });
    }
    // /admin/session
    if (seg.length === 1 && seg[0] === 'session') {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      if (!ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500, headers });
      }
      let sessionSecret: Buffer;
      try {
        sessionSecret = getAdminSessionSecret();
      } catch (error) {
        console.warn('[admin/session] Failed to load admin session secret', error);
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500, headers });
      }
      // Accept Firebase ID token from Authorization: Bearer <idToken>
      const fbHeader = req.headers.get('authorization') || req.headers.get('x-firebase-authorization');
      const { verifyFirebaseIdToken } = await import('@/api/lib/firebaseAdmin');
      const fbUser = await verifyFirebaseIdToken(fbHeader);
      if (!fbUser) {
        console.warn('[admin/session] Invalid Firebase token');
        return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401, headers });
      }
      if (!fbUser.email) {
        console.warn('[admin/session] Firebase token has no email');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
      }
      if (fbUser.email !== ADMIN_EMAIL) {
        console.warn('[admin/session] Email mismatch', { fbEmail: fbUser.email });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
      }
      const jwtMod = await import('jsonwebtoken');
      const expiresIn = Number(process.env.ADMIN_SESSION_TTL_SECONDS || '3600');
      const token = jwtMod.sign({ email: fbUser.email }, sessionSecret, { expiresIn, algorithm: 'HS256' });
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      return NextResponse.json({ token, expiresAt }, { headers });
    }

    // /admin/mail/sync or legacy /admin/sync-mails
    if ((seg.length === 2 && seg[0] === 'mail' && seg[1] === 'sync') || (seg.length === 1 && seg[0] === 'sync-mails')) {
      await connectDB();
      const msgs = await listNewMessages('newer_than:7d');
      let matched = 0;
      for (const m of msgs) {
        const headersArr: any[] = m.payload?.headers || [];
        const header = (name: string) => (headersArr.find((x: any) => x.name?.toLowerCase() === name.toLowerCase())?.value || null);
        const subject = header('Subject');
        const from = header('From');
        const to = header('To');
        const date = header('Date');
        const threadId = m.threadId as string | undefined;
        let c: any = null;
        if (subject) {
          const match = subject.match(/CASE-([a-f0-9]{24})/i);
          if (match) c = await CaseModel.findById(match[1]);
        }
        if (!c && from) {
          const emailMatch = from.match(/<([^>]+)>/);
          const sender = emailMatch ? emailMatch[1] : from;
          c = await CaseModel.findOne({ userEmail: sender.toLowerCase() });
        }
        if (!c) continue;
        matched++;
        c.emails = c.emails || [];
        c.emails.push({ subject: subject || '', body: '', to: to || '', from: from || '', sentAt: date ? new Date(date) : new Date(), threadId });
        if (!c.threadId && threadId) c.threadId = threadId;
        await c.save();
      }
      return NextResponse.json({ ok: true, scanned: msgs.length, matched }, { headers });
    }
    // /admin/stores (create)
    if (seg.length === 1 && seg[0] === 'stores') {
      const payload = await req.json().catch(() => null as unknown);
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
      }
      const storeId = normalizeStoreId((payload as any).storeId);
      const name = normalizeName((payload as any).name);
      const primaryColor = normalizeColor((payload as any).primaryColor);
      const secondaryColor = normalizeColor((payload as any).secondaryColor);
      const email = normalizeEmail((payload as any).email);
      if (!storeId) return NextResponse.json({ error: 'Store ID is required and must be valid.' }, { status: 400, headers });
      if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400, headers });
      if (!primaryColor) return NextResponse.json({ error: 'Primary color must be a hex value.' }, { status: 400, headers });
      if (!secondaryColor) return NextResponse.json({ error: 'Secondary color must be a hex value.' }, { status: 400, headers });
      if (!email) return NextResponse.json({ error: 'Valid email is required.' }, { status: 400, headers });
      await connectDB();
      const existing = await StoreModel.findOne({ storeId }).lean();
      if (existing) return NextResponse.json({ error: 'Store ID already exists.' }, { status: 409, headers });
      const created = await StoreModel.create({ storeId, name, primaryColor, secondaryColor, email });
      return NextResponse.json(serializeStore(created), { status: 201, headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin catch-all] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}
