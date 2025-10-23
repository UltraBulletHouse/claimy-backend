import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../../../../api/lib/db';
import CaseModel from '../../../../api/models/Case';
import { assertAdmin } from '../../../../api/middleware/admin';

export async function GET(req: NextRequest) {
  try {
    await assertAdmin(req);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { store: regex },
        { product: regex },
        { description: regex },
        { userEmail: regex },
      ];
    }

    const cases = await CaseModel.find(filter).sort({ createdAt: -1 });
    return NextResponse.json(cases);
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error('[admin/cases] GET failed', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
