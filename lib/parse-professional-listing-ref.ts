import { routing } from "@/i18n/routing";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract a public professional slug (or UUID) from a pasted DocCy profile URL/path.
 * Accepts full URLs (`http://localhost:3000/en/slug`) or path-only (`/en/slug`).
 */
export function parseProfessionalListingRef(
  raw: string | null | undefined,
): { kind: "slug" | "uuid"; value: string } | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  if (UUID_RE.test(trimmed)) {
    return { kind: "uuid", value: trimmed.toLowerCase() };
  }

  let path = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      path = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  const parts = path
    .split("?")[0]
    ?.split("#")[0]
    ?.split("/")
    .map((p) => decodeURIComponent(p.trim()))
    .filter(Boolean);
  if (!parts?.length) return null;

  const locales = new Set(routing.locales.map((l) => l.toLowerCase()));
  let start = 0;
  if (locales.has(parts[0]!.toLowerCase())) start = 1;
  const slug = parts[start]?.trim() ?? "";
  if (!slug || slug.includes("/")) return null;
  if (UUID_RE.test(slug)) return { kind: "uuid", value: slug.toLowerCase() };
  return { kind: "slug", value: slug };
}
