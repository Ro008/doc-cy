/**
 * Outbound WhatsApp via third-party webhooks (e.g. CallMeBot).
 * Single implementation for app + CI scripts.
 */

const DEFAULT_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * @param {string} webhookUrl
 * @returns {URL}
 */
export function normalizeWebhookUrl(webhookUrl) {
  const trimmed = String(webhookUrl ?? "")
    .trim()
    .replace(/\r|\n/g, "");
  if (!trimmed) {
    throw new Error("Webhook URL is empty");
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use http or https");
  }
  parsed.searchParams.delete("text");
  return parsed;
}

/**
 * @param {URL} base
 * @param {string} text
 */
function buildGetUrl(base, text) {
  const u = new URL(base.toString());
  u.searchParams.set("text", text);
  return u.toString();
}

/**
 * @param {Response} res
 */
async function readResponseSnippet(res) {
  try {
    const body = await res.text();
    const oneLine = body.replace(/\s+/g, " ").trim();
    return oneLine.slice(0, 200) || `(empty body, status ${res.status})`;
  } catch {
    return `(unreadable body, status ${res.status})`;
  }
}

/**
 * @param {string} label
 * @param {() => Promise<Response>}
 */
async function tryDelivery(label, attemptFn) {
  const res = await attemptFn();
  if (res.ok) {
    return { ok: true, method: label };
  }
  const snippet = await readResponseSnippet(res);
  return { ok: false, error: `${label}: HTTP ${res.status} — ${snippet}` };
}

/**
 * @param {string} webhookUrl
 * @param {string} text
 * @param {{ attempts?: number }} [options]
 * @returns {Promise<{ ok: true, method: string } | { ok: false, error: string, log: string[] }>}
 */
export async function sendWhatsAppWebhookMessage(webhookUrl, text, options = {}) {
  const message = String(text ?? "").trim();
  if (!message) {
    return { ok: false, error: "Message text is empty", log: [] };
  }

  const base = normalizeWebhookUrl(webhookUrl);
  const postTarget = base.toString();
  const getUrl = buildGetUrl(base, message);
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const log = [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    log.push(`attempt ${attempt}/${attempts}`);

    const strategies = [
      {
        label: "GET ?text=",
        run: () =>
          fetch(getUrl, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
      },
      {
        label: "POST JSON {text}",
        run: () =>
          fetch(postTarget, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
            redirect: "follow",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
      },
      {
        label: "POST form text=",
        run: () =>
          fetch(postTarget, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ text: message }),
            redirect: "follow",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }),
      },
    ];

    for (const strategy of strategies) {
      try {
        const result = await tryDelivery(strategy.label, strategy.run);
        if (result.ok) {
          log.push(`${strategy.label}: OK`);
          return { ok: true, method: strategy.label };
        }
        log.push(result.error);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`${strategy.label}: ${msg}`);
      }
    }

    if (attempt < attempts) {
      const delayMs = attempt * 2000;
      log.push(`waiting ${delayMs}ms before retry`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return {
    ok: false,
    error: "All delivery strategies failed after retries",
    log,
  };
}
