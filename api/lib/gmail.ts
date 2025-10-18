import { google } from 'googleapis';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GMAIL_OAUTH_REFRESH_TOKEN,
} = process.env;

export function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !GMAIL_OAUTH_REFRESH_TOKEN) {
    throw new Error('Gmail OAuth2 env vars are not fully configured.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: GMAIL_OAUTH_REFRESH_TOKEN });
  return oauth2Client;
}

function makeEmail({ to, from, subject, body }: { to: string; from: string; subject: string; body: string }) {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\r\n');

  // Base64 URL safe
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendComplaintEmail(params: {
  to?: string;
  from?: string;
  subject: string;
  body: string;
}) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const to = params.to || 'jarothepro@gmail.com';
  const from = params.from || 'me'; // 'me' tells Gmail API to use the authenticated account

  const raw = makeEmail({ to, from, subject: params.subject, body: params.body });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  const id = (res.data.id as string) || null;
  const threadId = (res.data.threadId as string) || null;
  return { id, threadId };
}
