import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../api/lib/db';
import CaseModel from '../../../../../api/models/Case';
import { assertAdmin } from '../../../../../api/middleware/admin';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdmin(req);
    await connectDB();
    const c = await CaseModel.findById(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(c);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id] GET failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertAdmin(req);
    await connectDB();
    await CaseModel.findByIdAndDelete(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id] DELETE failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
