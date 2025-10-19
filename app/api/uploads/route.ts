import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/api/lib/cloudinary';
import { getUserFromToken } from '@/api/lib/auth';
import { connectDB } from '@/api/lib/db';
import formidable from 'formidable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}

function parseForm(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }>{
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true, maxFileSize: 5 * 1024 * 1024 });
    // Convert the request body to a Node.js readable stream
    const chunks: Uint8Array[] = [];
    req.body?.getReader?.();
    // NextRequest doesn't expose raw stream directly; use arrayBuffer
    req
      .arrayBuffer()
      .then((buf) => {
        const rb = Buffer.from(buf);
        // formidable expects a Node IncomingMessage; use a shim via form.parse
        // @ts-ignore
        form.parse({ headers: Object.fromEntries(req.headers as any) , on: (event: string, cb: any) => {} } as any, (err, fields, files) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
      })
      .catch(reject);
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const user = await getUserFromToken(authHeader);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    // Use a simpler approach: use Cloudinary unsigned direct upload via base64, but keep keys server-side.
    // We'll accept two parts: product and receipt as files.
    const formData = await req.formData();
    const product = formData.get('product') as File | null;
    const receipt = formData.get('receipt') as File | null;

    async function uploadOne(file: File | null, folder: string) {
      if (!file) return null;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const res = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            quality: 'auto',
            fetch_format: 'auto',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      return res?.secure_url as string;
    }

    const [productUrl, receiptUrl] = await Promise.all([
      uploadOne(product, `claimy/${user.userId}`),
      uploadOne(receipt, `claimy/${user.userId}`),
    ]);

    return NextResponse.json({ productImageUrl: productUrl, receiptImageUrl: receiptUrl });
  } catch (e: any) {
    console.error('Upload error', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
