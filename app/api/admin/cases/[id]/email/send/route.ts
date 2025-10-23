import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../../api/lib/db';
import CaseModel from '../../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../../api/middleware/admin';
import { sendEmail } from '../../../../../../../api/lib/gmail';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdmin(req);
    await connectDB();

    const body = await req.json();
    const { subject, body: textBody, attachments } = body;
    if (!subject || !textBody) return NextResponse.json({ error: 'subject and body required' }, { status: 400 });

    const c = await CaseModel.findById(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const to = c.userEmail || '';
    if (!to) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400 });

    const result = await sendEmail({ to, subject, body: textBody });

    const emailEntry = {
      subject,
      body: textBody,
      to,
      from: process.env.GMAIL_USER || 'me',
      sentAt: new Date(),
      threadId: result.threadId || c.threadId || null,
    } as any;

    c.emails = c.emails || [];
    c.emails.push(emailEntry);
    if (!c.threadId && result.threadId) c.threadId = result.threadId;
    await c.save();

    return NextResponse.json({ ok: true, messageId: result.id, threadId: c.threadId });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/email/send] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
