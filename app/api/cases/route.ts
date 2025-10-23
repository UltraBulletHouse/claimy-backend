import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/api/lib/db';
import CaseModel from '@/api/models/Case';
import { getUserFromToken } from '@/api/lib/auth';
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
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sort = (searchParams.get('sort') || '-createdAt') as string;

    const [items, total] = await Promise.all([
      CaseModel.find({ userId: user.userId })
        .sort(sort)
        .skip(Math.max(offset, 0))
        .limit(Math.max(limit, 1)),
      CaseModel.countDocuments({ userId: user.userId }),
    ]);

    return new NextResponse(
      JSON.stringify({ items: items.map((x) => x.toJSON()), total, limit, offset }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('GET /api/cases error', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

   const contentType = req.headers.get('content-type') || '';
   let body: any = null;
   let uploaded: { productImageUrl?: string | null; receiptImageUrl?: string | null } = {};

   if (contentType.includes('multipart/form-data')) {
     // Parse formdata and upload images to Cloudinary
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
       // The default export from our wrapper is the configured Cloudinary v2 instance
       const cloudinary = (await import('@/api/lib/cloudinary')).default as any;
       const res = await new Promise<any>((resolve, reject) => {
         const uploadStream = cloudinary.uploader.upload_stream(
           {
             folder,
             resource_type: 'image',
             quality: 'auto',
             fetch_format: 'auto',
             transformation: [{ quality: 'auto', fetch_format: 'auto' }],
           },
           (error: any, result: any) => {
             if (error) return reject(error);
             resolve(result);
           }
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
       return new NextResponse(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
     }
   }

   const { store, product, description, images } = body as Partial<{
      store: string;
      product: string;
      description: string;
      images: string[];
    }>;

    if (!isNonEmptyString(store)) {
      return new NextResponse(JSON.stringify({ error: 'Store is required' }), { status: 400, headers });
    }
    if (!isNonEmptyString(product)) {
      return new NextResponse(JSON.stringify({ error: 'Product is required' }), { status: 400, headers });
    }
    if (!isNonEmptyString(description)) {
      return new NextResponse(JSON.stringify({ error: 'Description is required' }), { status: 400, headers });
    }

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

    return new NextResponse(JSON.stringify(doc.toJSON()), { status: 201, headers });
  } catch (err) {
    console.error('POST /api/cases error', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
