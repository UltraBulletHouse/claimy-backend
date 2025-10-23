import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../../../api/lib/db';
import CaseModel from '../../../../../../api/models/Case';
import { assertAdmin } from '../../../../../../api/middleware/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await assertAdmin(req);
    await connectDB();

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    const updated = await CaseModel.findByIdAndUpdate(
      params.id,
      { manualAnalysis: { text, updatedAt: new Date() } },
      { new: true }
    );

    return NextResponse.json(updated);
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases/:id/analysis] POST failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
