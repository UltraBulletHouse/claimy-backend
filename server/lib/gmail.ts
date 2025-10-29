import { google } from 'googleapis';

const env = process.env as Record<string, string | undefined>;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || env.GMAIL_REDIRECT_URI;
const GMAIL_OAUTH_REFRESH_TOKEN = env.GMAIL_OAUTH_REFRESH_TOKEN || env.GMAIL_REFRESH_TOKEN;
const GMAIL_USER = env.GMAIL_USER || undefined;
let GMAIL_PROFILE_EMAIL: string | null = null;

export function getOAuth2Client() {
  const has = {
    clientId: !!GOOGLE_CLIENT_ID,
    clientSecret: !!GOOGLE_CLIENT_SECRET,
    redirectUri: !!GOOGLE_REDIRECT_URI,
    refreshToken: !!GMAIL_OAUTH_REFRESH_TOKEN,
    gmailUser: !!GMAIL_USER,
  };
  if (!has.clientId || !has.clientSecret || !has.redirectUri || !has.refreshToken) {
    
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

export async function sendComplaintEmail(params: { to?: string; from?: string; subject: string; body: string; }) {
  
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Resolve profile email once for logs (sender identity)
  if (!GMAIL_PROFILE_EMAIL) {
    try {
      const prof = await gmail.users.getProfile({ userId: 'me' });
      GMAIL_PROFILE_EMAIL = prof.data.emailAddress || null;
      
    } catch (e) {
      console.warn('[gmail] failed to fetch profile');
    }
  }

  const to = params.to || (GMAIL_USER as string);
  const from = params.from || 'me'; // 'me' tells Gmail API to use the authenticated account

  const raw = makeEmail({ to, from, subject: params.subject, body: params.body });
  
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  const id = (res.data.id as string) || null;
  const threadId = (res.data.threadId as string) || null;
  
  return { id, threadId };
}

export async function sendEmail({ to, subject, body, attachments, threadId, replyMessageId, references }: { to: string; subject: string; body: string; attachments?: Array<{ filename: string; contentType: string; content: Buffer | string; }>; threadId?: string; replyMessageId?: string; references?: string[]; }) {
  
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const from = 'me';

  // Build MIME message with optional attachments (simple multipart/mixed)
  const boundary = 'foo_bar_baz_' + Date.now();
  const headers = [
    `To: ${to}`,
    GMAIL_USER ? `From: ${GMAIL_USER}` : 'From: me',
    `Subject: ${subject}`,
    ...(replyMessageId ? [`In-Reply-To: <${replyMessageId}>`] : []),
    ...(references && references.length ? [`References: ${references.map(id => `<${id}>`).join(' ')}`] : []),
    'MIME-Version: 1.0',
  ];

  let mime = '';
  if (attachments && attachments.length) {
    headers.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
    const parts: string[] = [];
    // Body part
    parts.push([
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n'));

    // Attachments
    for (const a of attachments) {
      const data = typeof a.content === 'string' ? a.content : Buffer.from(a.content).toString('base64');
      parts.push([
        `--${boundary}`,
        `Content-Type: ${a.contentType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        data,
      ].join('\r\n'));
    }
    parts.push(`--${boundary}--`);
    mime = headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    mime = headers.join('\r\n') + '\r\n\r\n' + body;
  }

  const raw = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId } as any });
    
    return { id: res.data.id, threadId: res.data.threadId };
  } catch (err: any) {
    // Log the google error details if present
    const details = err?.errors || err?.response?.data || err?.message || err;
    
    throw err;
  }
}

export async function fetchThread(threadId: string) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId });
  return res.data;
}

export async function listNewMessages(query?: string) {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const list = await gmail.users.messages.list({ userId: 'me', q: query });
  const messages = list.data.messages || [];
  const full: any[] = [];
  for (const m of messages) {
    if (!m.id) continue;
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id });
    full.push(msg.data);
  }
  return full;
}
