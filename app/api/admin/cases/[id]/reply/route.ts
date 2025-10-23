import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import CaseModel from '../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../api/middleware/admin';
import { sendEmail } from '../../../../../../api/lib/gmail';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdmin(req);
    await connectDB();

    const payload = await req.json();
    const { body: textBody, subject } = payload;
    if (!textBody) return NextResponse.json({ error: 'body required' }, { status: 400 });

    const c = await CaseModel.findById(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!c.userEmail) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400 });

    const res = await sendEmail({ to: c.userEmail, subject: subject || 'Re: case update', body: textBody, threadId: c.threadId || undefined });
    c.emails = c.emails || [];
    c.emails.push({ subject: subject || '', body: textBody, to: c.userEmail, from: process.env.GMAIL_USER || 'me', sentAt: new Date(), threadId: res.threadId || c.threadId || undefined } as any);
    if (!c.threadId && res.threadId) c.threadId = res.threadId;
    await c.save();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/reply] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
