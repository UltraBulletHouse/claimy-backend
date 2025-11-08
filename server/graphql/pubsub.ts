import { createPubSub } from '@graphql-yoga/subscription';

export interface NotificationStreamPayload {
  id: string;
  userId: string;
  caseId: string;
  oldStatus: string | null;
  newStatus: string;
  seen: boolean;
  createdAt: string;
  case?: {
    id: string;
    product?: string | null;
    store?: string | null;
    description?: string | null;
    status?: string | null;
  } | null;
}

export const notificationPubSub = createPubSub<{
  notificationAdded: [string, NotificationStreamPayload];
}>();
