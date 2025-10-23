import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import CaseModel from '../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../api/middleware/admin';
import { updateCaseStatus } from '../../../../../../api/lib/caseUtils';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await assertAdmin(req);
    await connectDB();

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    await CaseModel.findByIdAndUpdate(params.id, { resolution: { code, addedAt: new Date() } });
    await updateCaseStatus(params.id, 'APPROVED', 'Resolution code attached', admin.email);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/code] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
