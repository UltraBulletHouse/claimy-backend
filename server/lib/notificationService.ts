import type { CaseDocument } from '../models/Case';
import UserNotificationModel, { UserNotificationDocument } from '../models/UserNotification';
import { sendFCMNotification } from './fcm';
import { notificationPubSub, NotificationStreamPayload } from '../graphql/pubsub';

export type SerializedNotification = NotificationStreamPayload;

function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function buildCaseSummary(caseDoc?: CaseDocument | null) {
  if (!caseDoc) {
    return null;
  }
  return {
    id: caseDoc.id ?? caseDoc._id.toString(),
    product: (caseDoc as any).product ?? null,
    store: (caseDoc as any).store ?? null,
    description: (caseDoc as any).description ?? null,
    status: (caseDoc as any).status ?? null
  };
}

export function serializeNotification(
  notification: UserNotificationDocument,
  caseDoc?: CaseDocument | null
): SerializedNotification {
  return {
    id: notification.id ?? notification._id.toString(),
    userId: notification.userId,
    caseId: notification.caseId.toString(),
    oldStatus: notification.oldStatus ?? null,
    newStatus: notification.newStatus,
    seen: notification.seen,
    createdAt: notification.createdAt?.toISOString?.() ?? new Date().toISOString(),
    case: buildCaseSummary(caseDoc)
  };
}

async function publishRealtimeNotification(
  notification: UserNotificationDocument,
  caseDoc?: CaseDocument | null
) {
  const serialized = serializeNotification(notification, caseDoc);
  notificationPubSub.publish('notificationAdded', notification.userId, serialized);
  return serialized;
}

async function deliverFcmNotification(
  caseDoc: CaseDocument,
  newStatus: string
): Promise<void> {
  const title = 'Case status updated';
  const caseLabel =
    (caseDoc as any).product ||
    (caseDoc as any).description ||
    (caseDoc as any).store ||
    caseDoc.id ||
    'Case';
  const body = `${caseLabel} is now ${formatStatusLabel(newStatus)}.`;

  try {
    await sendFCMNotification(caseDoc.userId, title, body);
  } catch (error) {
    console.error('Failed to send FCM notification', error);
  }
}

// Event hook: invoked whenever a case status changes. This is the single place
// where we persist, push, and broadcast a notification, which also makes it the
// ideal spot to plug in future ML/AI models (e.g. suppression, ranking) before
// the event fan-outs happen.
export async function createCaseStatusNotification(params: {
  caseDoc: CaseDocument;
  oldStatus?: string | null;
  newStatus: string;
}): Promise<SerializedNotification | null> {
  const { caseDoc, oldStatus = null, newStatus } = params;
  if (!caseDoc?.userId) {
    return null;
  }

  const notification = await UserNotificationModel.create({
    userId: caseDoc.userId,
    caseId: caseDoc._id,
    oldStatus,
    newStatus,
    seen: false
  });

  const serialized = await publishRealtimeNotification(notification, caseDoc);
  await deliverFcmNotification(caseDoc, newStatus);

  return serialized;
}
