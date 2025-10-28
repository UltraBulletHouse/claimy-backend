let cachedAdminEmail: string | null = null;

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function getAdminEmail(): string {
  if (cachedAdminEmail) {
    return cachedAdminEmail;
  }
  const normalized = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!normalized) {
    throw new Error('Missing ADMIN_EMAIL');
  }
  cachedAdminEmail = normalized;
  return cachedAdminEmail;
}

export function matchesAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = getAdminEmail();
  const normalized = normalizeEmail(email);
  return !!normalized && normalized === adminEmail;
}
