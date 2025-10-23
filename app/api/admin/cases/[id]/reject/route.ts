import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import { assertAdmin } from '../../../../../../api/middleware/admin';
import { updateCaseStatus } from '../../../../../../api/lib/caseUtils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await assertAdmin(req);
    await connectDB();
    await updateCaseStatus(params.id, 'REJECTED', undefined, admin.email);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/reject] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
