import admin from 'firebase-admin';

let app: admin.app.App | null = null;

function normalizePrivateKey(raw?: string): string | null {
  if (!raw) return null;
  let key = raw.trim();
  // If the value is wrapped in quotes, strip them
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.substring(1, key.length - 1);
  }
  // Replace escaped newlines
  key = key.replace(/\\n/g, '\n');
  return key;
}

function initFirebaseAdmin() {
  if (app) return app;

  const env = process.env as Record<string, string | undefined>;
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_PRIVATE_KEY_BASE64,
  } = env;

  const hasDirectKey = !!(FIREBASE_PRIVATE_KEY || FIREBASE_PRIVATE_KEY_BASE64);
  const useADC = !!env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!FIREBASE_PROJECT_ID || (!hasDirectKey && !useADC)) {
    console.warn('Firebase Admin env vars are not fully set. Provide FIREBASE_* key or GOOGLE_APPLICATION_CREDENTIALS.');
    return null as any;
  }

  
  let privateKey: string | null = normalizePrivateKey(FIREBASE_PRIVATE_KEY);
  if (!privateKey && FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      privateKey = Buffer.from(FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
    } catch (e) {
      console.error('Failed to decode FIREBASE_PRIVATE_KEY_BASE64', e);
    }
  }

  try {
    if (admin.apps.length) {
      app = admin.app();
    } else if (useADC && !privateKey) {
      // Use Application Default Credentials
      app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      } as any);
    } else {
      if (!privateKey) {
        console.error('Firebase private key is missing or invalid after normalization.');
        return null as any;
      }
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin. Check FIREBASE_* env vars or GOOGLE_APPLICATION_CREDENTIALS. Error:', e);
    return null as any;
  }

  return app;
}

export async function verifyFirebaseIdToken(authHeader?: string | null): Promise<{ uid: string; email: string | null } | null> {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];

  const initialized = initFirebaseAdmin();
  if (!initialized) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (e) {
    console.error('Firebase verifyIdToken failed:', (e as Error)?.message || e);
    return null;
  }
}
