import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import CaseModel from '../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../api/middleware/admin';
import { fetchThread } from '../../../../../../api/lib/gmail';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdmin(req);
    await connectDB();

    const c = await CaseModel.findById(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!c.threadId) return NextResponse.json({ error: 'No threadId for case' }, { status: 400 });

    const thr = await fetchThread(c.threadId);
    return NextResponse.json(thr);
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/thread] GET failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
