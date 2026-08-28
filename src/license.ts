const SLUG = 'training-log-merge';
const TOKEN_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const API_BASE = import.meta.env.VITE_BILLING_API || 'https://api.sociobot.in/api/v1';

interface Verdict { valid: boolean; checkedAt: number; reason?: string }

export const checkoutUrl = `${API_BASE}/products/${SLUG}/checkout`;

export function captureLicenseFromUrl(): boolean {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: true, checkedAt: 0 }));
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function storeLicense(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export function licenseToken(): string { return localStorage.getItem(TOKEN_KEY) ?? ''; }

export function cachedUnlocked(): boolean {
  try { return Boolean(licenseToken() && (JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '{}') as Verdict).valid); }
  catch { return false; }
}

export async function verifyLicense(force = false): Promise<{ valid: boolean; reason?: string }> {
  const token = licenseToken();
  if (!token) return { valid: false, reason: 'missing' };
  try {
    const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '{}') as Verdict;
    if (!force && cached.checkedAt && Date.now() - cached.checkedAt < 86_400_000) return cached;
  } catch { /* verify below */ }
  try {
    const response = await fetch(`${API_BASE}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verify unavailable');
    const result = await response.json() as { valid: boolean; reason?: string };
    const verdict: Verdict = { valid: result.valid, reason: result.reason, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    return verdict;
  } catch {
    return { valid: cachedUnlocked(), reason: 'offline' };
  }
}
