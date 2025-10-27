import CaseModel from '../models/Case';

export async function updateCaseStatus(id: string, newStatus: string, note: string | undefined, by: string) {
  await CaseModel.findByIdAndUpdate(id, {
    status: newStatus,
    $push: { statusHistory: { status: newStatus, by, at: new Date(), note } },
  });
}
