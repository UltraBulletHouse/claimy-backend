import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../api/lib/db';
import CaseModel from '../../../../../api/models/Case';
import { assertAdmin } from '../../../../../api/middleware/admin';
import { listNewMessages } from '../../../../../api/lib/gmail';

function header(headers: any[], name: string): string | null {
  const h = headers?.find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || null;
}

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req);
    await connectDB();

    const msgs = await listNewMessages('newer_than:7d');

    let matched = 0;
    for (const m of msgs) {
      const headers = m.payload?.headers || [];
      const subject = header(headers, 'Subject');
      const from = header(headers, 'From');
      const to = header(headers, 'To');
      const date = header(headers, 'Date');
      const threadId = m.threadId as string | undefined;

      // Try match by subject containing case id or by user email
      let c = null as any;
      if (subject) {
        const match = subject.match(/CASE-([a-f0-9]{24})/i);
        if (match) {
          c = await CaseModel.findById(match[1]);
        }
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

    return NextResponse.json({ ok: true, scanned: msgs.length, matched });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/mail/sync] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
