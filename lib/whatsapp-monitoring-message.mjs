/**
 * Nightly WhatsApp copy for Production Monitoring (edge vs origin experiment).
 */

export function formatJobStatus(result, label) {
  switch (result) {
    case "success":
      return `✅ ${label} OK`;
    case "cancelled":
      return `⚠️ ${label} CANCELLED`;
    case "skipped":
      return `⚠️ ${label} SKIPPED`;
    default:
      return `❌ ${label} FAIL`;
  }
}

/**
 * @param {string} edgeResult
 * @param {string} originResult
 */
export function interpretEdgeVsOrigin(edgeResult, originResult) {
  const edge = String(edgeResult ?? "unknown");
  const origin = String(originResult ?? "unknown");

  if (origin === "skipped") {
    return "Set PLAYWRIGHT_BASE_URL_VERCEL_PROD to compare Cloudflare vs Vercel origin";
  }
  if (edge === "failure" && origin === "success") {
    return "Likely Cloudflare Bot Fight Mode (Vercel origin healthy)";
  }
  if (edge === "success" && origin === "success") {
    return "Both Cloudflare edge and Vercel origin healthy";
  }
  if (origin === "failure" && (edge === "success" || edge === "skipped")) {
    return "App/origin failed — not only Cloudflare";
  }
  if (edge === "failure" && origin === "failure") {
    return "Both paths failed — check app and Cloudflare";
  }
  return "";
}

export function buildNightlyWhatsAppMessage(input) {
  const {
    notifyOnly = false,
    extra = "",
    runId = "local",
    emailResult = "unknown",
    edgeResult = "unknown",
    originResult = "unknown",
  } = input ?? {};

  if (notifyOnly) {
    let msg = `🧪 DocCy PROD manual WhatsApp test | run ${runId}`;
    if (extra) msg += ` | ${extra}`;
    return msg;
  }

  const originBlockingFail = originResult === "failure";
  const emailFail = emailResult === "failure";
  const edgeFail = edgeResult === "failure";
  const originSkipped = originResult === "skipped";

  let icon = "✅";
  if (originBlockingFail || emailFail) icon = "❌";
  else if (edgeFail && !originSkipped) icon = "⚠️";
  else if (edgeFail && originSkipped) icon = "❌";

  const parts = [
    `${icon} DocCy nightly`,
    formatJobStatus(emailResult, "Email guards"),
    formatJobStatus(edgeResult, "Edge mydoccy.com"),
    formatJobStatus(originResult, "Origin Vercel"),
    `run ${runId}`,
  ];

  const hint = interpretEdgeVsOrigin(edgeResult, originResult);
  let msg = parts.join(" | ");
  if (hint) msg += ` | ${hint}`;
  if (extra) msg += ` | ${extra}`;
  return msg;
}
