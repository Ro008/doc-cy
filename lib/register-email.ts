/**
 * Email rule for /register, shared by the HTML `pattern` and code.
 *
 * Browsers compile `pattern` with the `v` flag (Chrome 112+), where an unescaped
 * "-" inside a character class is a syntax error — and an invalid pattern is
 * silently ignored, so "name@a" used to pass. Keep the hyphens escaped.
 */
export const REGISTER_EMAIL_HTML_PATTERN = "[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}";

const REGISTER_EMAIL_RE = new RegExp(`^(?:${REGISTER_EMAIL_HTML_PATTERN})$`);

export function isValidRegisterEmail(email: string): boolean {
  return REGISTER_EMAIL_RE.test(email.trim());
}

/** Providers professionals in Cyprus commonly use; typos here cost a confirmation email. */
const KNOWN_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.gr",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.gr",
  "outlook.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
  "cytanet.com.cy",
  "primehome.com",
  "otenet.gr",
  "mail.ru",
  "yandex.ru",
] as const;

const TLD_TYPOS: Record<string, string> = { con: "com", cmo: "com", ocm: "com", comm: "com", vom: "com", xom: "com" };

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/**
 * "Did you mean …?" for a near miss on a common provider (gmial.com → gmail.com,
 * cytanet.com → cytanet.com.cy) or a mistyped ".com". Null when the address
 * looks right or the domain is simply one we do not know.
 */
export function suggestRegisterEmail(email: string): string | null {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if ((KNOWN_EMAIL_DOMAINS as readonly string[]).includes(domain)) return null;

  const missingSuffix = KNOWN_EMAIL_DOMAINS.find((known) => known.startsWith(`${domain}.`));
  if (missingSuffix) return `${local}@${missingSuffix}`;

  // Short domains get less slack so real ones (e.g. life.com) are not "corrected".
  const maxDistance = domain.length >= 9 ? 2 : 1;
  let best: { domain: string; distance: number } | null = null;
  for (const known of KNOWN_EMAIL_DOMAINS) {
    const distance = editDistance(domain, known);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { domain: known, distance };
    }
  }
  if (best) return `${local}@${best.domain}`;

  const dot = domain.lastIndexOf(".");
  const tldFix = dot > 0 ? TLD_TYPOS[domain.slice(dot + 1)] : undefined;
  return tldFix ? `${local}@${domain.slice(0, dot + 1)}${tldFix}` : null;
}
