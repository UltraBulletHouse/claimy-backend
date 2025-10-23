import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import CaseModel from '../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../api/middleware/admin';
import { sendEmail } from '../../../../../../api/lib/gmail';
import { updateCaseStatus } from '../../../../../../api/lib/caseUtils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await assertAdmin(req);
    await connectDB();
    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

    const c = await CaseModel.findById(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!c.userEmail) return NextResponse.json({ error: 'Case has no userEmail' }, { status: 400 });

    await sendEmail({ to: c.userEmail, subject: 'Need more information for your case', body: message, threadId: c.threadId || undefined });
    await updateCaseStatus(params.id, 'NEED_INFO', 'Requested more info', admin.email);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/request-info] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
