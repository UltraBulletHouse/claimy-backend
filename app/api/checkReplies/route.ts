import { NextRequest, NextResponse } from 'next/server';
import { checkGmailReplies } from '@/api/lib/gmailListener';

export async function GET(_req: NextRequest) {
  try {
    const res = await checkGmailReplies();
    return NextResponse.json(res, { status: 200 });
  } catch (e: any) {
    console.error('checkReplies failed', e);
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
