import crypto from 'crypto';

let cachedRawSecret: string | null = null;
let cachedDerivedSecret: Buffer | null = null;

function loadRawSecret(): string {
  const secret = cachedRawSecret ?? process.env.ADMIN_SECRET_TOKEN ?? '';
  if (!secret || secret.trim().length === 0) {
    throw new Error('Missing ADMIN_SECRET_TOKEN');
  }
  cachedRawSecret = secret;
  return secret;
}

export function getAdminSecretRaw(): string {
  return loadRawSecret();
}

export function getAdminSessionSecret(): Buffer {
  if (cachedDerivedSecret) {
    return cachedDerivedSecret;
  }
  const raw = loadRawSecret();
  cachedDerivedSecret = crypto.createHash('sha256').update(raw).digest();
  return cachedDerivedSecret;
}
