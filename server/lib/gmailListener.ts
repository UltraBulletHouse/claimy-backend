import { google } from 'googleapis';
import { connectDB } from './db';
import CaseModel from '../models/Case';
import { getOAuth2Client } from './gmail';

export interface CheckRepliesResult {
  scanned: number;
  matched: number;
  updated: number;
  errors: number;
  details: Array<{ caseId: string; threadId: string; latestMessageId?: string; updated: boolean }>;
}

export async function checkGmailReplies(): Promise<CheckRepliesResult> {
  await connectDB();
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Fetch cases that have an associated threadId
  const cases = await CaseModel.find({ threadId: { $ne: null } }).limit(500);

  const result: CheckRepliesResult = { scanned: cases.length, matched: 0, updated: 0, errors: 0, details: [] };

  for (const c of cases) {
    try {
      const threadId = c.threadId as string;
      const thr = await gmail.users.threads.get({ userId: 'me', id: threadId });
      const messages = thr.data.messages || [];

      // Find the latest incoming message (not sent by me)
      let latestIncoming: any = null;
      for (const m of messages) {
        const labelIds = (m.labelIds || []) as string[];
        const isSentByMe = labelIds.includes('SENT');
        if (!isSentByMe) {
          if (!latestIncoming || Number(m.internalDate || 0) > Number(latestIncoming.internalDate || 0)) {
            latestIncoming = m;
          }
        }
      }

      if (!latestIncoming) {
        result.details.push({ caseId: c.id, threadId, updated: false });
        continue;
      }

      const lastKnown = c.lastEmailReplyAt ? c.lastEmailReplyAt.getTime() : 0;
      const msgTime = Number(latestIncoming.internalDate || 0);
      const msgId = latestIncoming.id as string | undefined;

      const alreadyProcessed = msgId && c.lastEmailMessageId && c.lastEmailMessageId === msgId;

      if (msgTime > lastKnown && !alreadyProcessed) {
        c.status = 'IN_REVIEW' as any;
        c.lastEmailReplyAt = new Date(msgTime);
        if (msgId) c.lastEmailMessageId = msgId;
        await c.save();
        result.matched += 1;
        result.updated += 1;
        result.details.push({ caseId: c.id, threadId, updated: true, latestMessageId: msgId });
        console.log(`[checkReplies] Case ${c.id} set to IN_REVIEW due to reply at ${new Date(msgTime).toISOString()}`);
      } else {
        result.details.push({ caseId: c.id, threadId, updated: false, latestMessageId: msgId });
      }
    } catch (e) {
      result.errors += 1;
      console.error('[checkReplies] Error processing case', c.id, e);
    }
  }

  return result;
}
