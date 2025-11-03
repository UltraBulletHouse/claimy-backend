import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import { getUserFromToken } from '@/api/lib/auth';
import CaseModel from '@/api/models/Case';
import StoreModel from '@/api/models/Store';
import cloudinary from '@/api/lib/cloudinary';
import { checkGmailReplies } from '@/api/lib/gmailListener';

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
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function segmentsAfterApi(req: NextRequest): string[] {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.findIndex(p => p === 'public');
  return idx >= 0 ? parts.slice(idx + 1) : [];
}

function isNonEmptyString(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function isStringArray(v: unknown): v is string[] { return Array.isArray(v) && v.every(x => typeof x === 'string'); }

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const seg = segmentsAfterApi(req);
    // /public/stores
    if (seg.length === 1 && seg[0] === 'stores') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      await connectDB();
      const stores = await StoreModel.find().sort({ name: 1 });
      const items = stores.map((s) => {
        const json = s.toJSON();
        if (!json.secondaryColor) json.secondaryColor = json.primaryColor;
        return json;
      });
      return NextResponse.json({ items, total: items.length }, { headers });
    }
    // /public/cases
    if (seg.length === 1 && seg[0] === 'cases') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      await connectDB();
      const { searchParams } = new URL(req.url);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const sort = (searchParams.get('sort') || '-createdAt') as string;
      const [items, total] = await Promise.all([
        CaseModel.find({ userId: user.userId }).sort(sort).skip(Math.max(offset, 0)).limit(Math.max(limit, 1)),
        CaseModel.countDocuments({ userId: user.userId }),
      ]);
      return NextResponse.json({ items: items.map(x => x.toJSON()), total, limit, offset }, { headers });
    }
    // /public/cases/:id/info-requests
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'info-requests') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

      const caseId = seg[1];
      await connectDB();
      const existing = await CaseModel.findOne({ _id: caseId, userId: user.userId });
      if (!existing) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404, headers });
      }

      const requestHistory = existing.infoRequestHistory || [];
      const responseHistory = existing.infoResponseHistory || [];

      // Filter pending requests and check if they have responses
      const pending = requestHistory
        .filter((req: any) => req.status === 'PENDING')
        .map((req: any) => ({
          id: req.id,
          message: req.message,
          requiresFile: req.requiresFile,
          requestedAt: req.requestedAt.toISOString(),
          hasResponse: responseHistory.some((res: any) => res.requestId === req.id),
        }));

      return NextResponse.json({ pending }, { headers });
    }
    
    // /public/checkReplies
    if (seg.length === 1 && seg[0] === 'checkReplies') {
      const res = await checkGmailReplies();
      return NextResponse.json(res, { headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    console.error('[public catch-all] GET failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const seg = segmentsAfterApi(req);
    // /public/cases
    if (seg.length === 1 && seg[0] === 'cases') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      const contentType = req.headers.get('content-type') || '';
      let body: any = null;
      let uploaded: { productImageUrl?: string | null; receiptImageUrl?: string | null } = {};
      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const store = formData.get('store')?.toString();
        const product = formData.get('product')?.toString();
        const description = formData.get('description')?.toString();
        const productFile = formData.get('productImage') as File | null;
        const receiptFile = formData.get('receiptImage') as File | null;
        async function uploadOne(file: File | null, folder: string) {
          if (!file) return null;
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const res = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
              (error, result) => { if (error) return reject(error); resolve(result); }
            );
            uploadStream.end(buffer);
          });
          return res?.secure_url as string;
        }
        const [productImageUrl, receiptImageUrl] = await Promise.all([
          uploadOne(productFile, `claimy/${user.userId}`),
          uploadOne(receiptFile, `claimy/${user.userId}`),
        ]);
        uploaded = { productImageUrl, receiptImageUrl };
        body = { store, product, description, images: [] };
      } else {
        body = await req.json().catch(() => null as unknown);
        if (!body || typeof body !== 'object') {
          return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
        }
      }
      const { store, product, description, images } = body as Partial<{ store: string; product: string; description: string; images: string[]; }>;
      if (!isNonEmptyString(store)) return NextResponse.json({ error: 'Store is required' }, { status: 400, headers });
      if (!isNonEmptyString(product)) return NextResponse.json({ error: 'Product is required' }, { status: 400, headers });
      if (!isNonEmptyString(description)) return NextResponse.json({ error: 'Description is required' }, { status: 400, headers });
      const normalizedImages = images && isStringArray(images) ? images : [];
      await connectDB();
      const doc = await CaseModel.create({
        userId: user.userId,
        userEmail: user.email,
        store: store.trim(),
        product: product.trim(),
        description: description.trim(),
        images: normalizedImages,
        ...(uploaded.productImageUrl ? { productImageUrl: uploaded.productImageUrl } : {}),
        ...(uploaded.receiptImageUrl ? { receiptImageUrl: uploaded.receiptImageUrl } : {}),
      });
      return NextResponse.json(doc.toJSON(), { status: 201, headers });
    }
    // /public/cases/:id/info-response
    if (seg.length === 3 && seg[0] === 'cases' && seg[2] === 'info-response') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });

      const caseId = seg[1];
      await connectDB();
      const existing = await CaseModel.findOne({ _id: caseId, userId: user.userId });
      if (!existing) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404, headers });
      }

      const contentType = req.headers.get('content-type') || '';
      let requestId: string | undefined;
      let answer: string | undefined;
      let uploadedUrl: string | null = null;
      let fileName: string | undefined;
      let fileType: string | undefined;

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        requestId = formData.get('requestId')?.toString();
        answer = formData.get('answer')?.toString() || undefined;
        const file = formData.get('attachment') as File | null;
        if (file) {
          // Generate unique response ID for folder organization
          const { randomUUID } = await import('crypto');
          const responseId = randomUUID();
          
          fileName = file.name;
          fileType = file.type;
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: `claimy/${user.userId}/info-responses/${responseId}`,
                resource_type: 'auto',
                quality: 'auto',
                fetch_format: 'auto',
              },
              (error, res) => (error ? reject(error) : resolve(res))
            );
            uploadStream.end(buffer);
          });
          uploadedUrl = result?.secure_url || null;
        }
      } else {
        const body = await req.json().catch(() => null as unknown);
        if (!body || typeof body !== 'object') {
          return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers });
        }
        requestId = (body as any).requestId?.toString();
        answer = (body as any).answer?.toString();
      }

      // Validate requestId exists if provided, otherwise use latest pending request
      if (!requestId) {
        // Find the most recent pending request
        const pendingRequests = (existing.infoRequestHistory || []).filter((r: any) => r.status === 'PENDING');
        if (pendingRequests.length > 0) {
          // Sort by requestedAt descending and take the first
          pendingRequests.sort((a: any, b: any) => b.requestedAt.getTime() - a.requestedAt.getTime());
          requestId = pendingRequests[0].id;
        } else {
          return NextResponse.json({ error: 'No pending info request found' }, { status: 400, headers });
        }
      }

      // Verify requestId exists in history
      const request = (existing.infoRequestHistory || []).find((r: any) => r.id === requestId);
      if (!request) {
        return NextResponse.json({ error: 'Invalid requestId' }, { status: 400, headers });
      }

      // Generate response ID
      const { randomUUID } = await import('crypto');
      const responseId = randomUUID();
      const now = new Date();

      // Add response to history
      const newResponse = {
        id: responseId,
        requestId: requestId,
        answer: answer || undefined,
        fileUrl: uploadedUrl ?? null,
        fileName: fileName || undefined,
        fileType: fileType || undefined,
        submittedAt: now,
        submittedBy: user.email || user.userId,
      };

      if (!existing.infoResponseHistory) {
        (existing as any).infoResponseHistory = [];
      }
      existing.infoResponseHistory.push(newResponse as any);

      // Update request status to ANSWERED
      if (existing.infoRequestHistory) {
        existing.infoRequestHistory = existing.infoRequestHistory.map((r: any) => 
          r.id === requestId ? { ...r, status: 'ANSWERED' } : r
        ) as any;
      }

      // Update legacy fields for backward compatibility
      existing.infoResponse = {
        answer: answer || undefined,
        fileUrl: uploadedUrl ?? null,
        submittedAt: now,
      } as any;

      existing.status = 'IN_REVIEW';
      existing.statusHistory = [
        ...(existing.statusHistory || []),
        { status: 'IN_REVIEW', by: user.email || user.userId, at: now, note: 'User provided additional information' },
      ];
      await existing.save();
      return NextResponse.json({ responseId, case: existing.toJSON() }, { status: 200, headers });
    }

    // /public/uploads
    if (seg.length === 1 && seg[0] === 'uploads') {
      const authHeader = req.headers.get('authorization');
      const user = await getUserFromToken(authHeader);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ error: 'Invalid content type' }, { status: 400, headers });
      }
      const formData = await req.formData();
      const product = formData.get('product') as File | null;
      const receipt = formData.get('receipt') as File | null;
      async function uploadOne(file: File | null, folder: string) {
        if (!file) return null;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const res = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image', quality: 'auto', fetch_format: 'auto', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
            (error, result) => { if (error) return reject(error); resolve(result); }
          );
          uploadStream.end(buffer);
        });
        return res?.secure_url as string;
      }
      const [productUrl, receiptUrl] = await Promise.all([
        uploadOne(product, `claimy/${user.userId}`),
        uploadOne(receipt, `claimy/${user.userId}`),
      ]);
      return NextResponse.json({ productImageUrl: productUrl, receiptImageUrl: receiptUrl }, { headers });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  } catch (e: any) {
    console.error('[public catch-all] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers });
  }
}
