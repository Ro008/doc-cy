/** Argument parsing for scripts/invite-admin.mjs (unit tested). */

export const ADMIN_INVITE_REDIRECT_PATH = "/internal/sign-in";

const ADMIN_ROLES = new Set(["founder", "partner"]);
const VALUE_FLAGS = new Set(["--email", "--name", "--role", "--env-file"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {string[]} argv
 * @returns {{ ok: true, value: { email: string, name: string, role: "founder" | "partner", envFile: string, dryRun: boolean, useExistingLogin: boolean } } | { ok: false, error: string }}
 */
export function parseAdminInviteArgs(argv) {
  const values = {};
  let dryRun = false;
  let useExistingLogin = false;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (flag === "--use-existing-login") {
      useExistingLogin = true;
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) return { ok: false, error: `Unknown argument: ${flag}` };
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `${flag} needs a value.` };
    }
    values[flag] = value;
    i += 1;
  }

  const email = String(values["--email"] ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "--email must be an email address." };
  const name = String(values["--name"] ?? "").trim();
  if (!name) return { ok: false, error: "--name is required." };
  const role = String(values["--role"] ?? "founder").trim();
  if (!ADMIN_ROLES.has(role)) return { ok: false, error: "--role must be founder or partner." };
  const envFile = String(values["--env-file"] ?? ".env.testing.local").trim();

  return { ok: true, value: { email, name, role, envFile, dryRun, useExistingLogin } };
}

/**
 * Why an existing login can't become an admin, or null if it can. Admins must
 * never share a login with a professional (lib/admin-auth-core.ts refuses those).
 * @param {{ login: { id: string, email: string } | null, linkedProfessionals: number, isAdmin: boolean }} input
 * @returns {string | null}
 */
export function existingLoginAdminProblem({ login, linkedProfessionals, isAdmin }) {
  if (!login) return "No login exists for this email; run without --use-existing-login to invite a new one.";
  if (linkedProfessionals > 0) {
    return `${login.email} is a professional's login. Admins need their own login; use another address.`;
  }
  if (isAdmin) return `${login.email} is already an admin.`;
  return null;
}

/** Where the invite email sends the new admin (they set a password, then enrol 2FA). */
export function adminInviteRedirectUrl(siteUrl) {
  const raw = String(siteUrl ?? "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid site URL: "${raw}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Site URL must be http(s): "${raw}"`);
  }
  return `${url.origin}${ADMIN_INVITE_REDIRECT_PATH}`;
}
