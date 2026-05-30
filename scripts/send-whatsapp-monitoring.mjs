#!/usr/bin/env node
/**
 * CI / manual: send production monitoring summary via WHATSAPP_WEBHOOK_URL.
 * Usage: node scripts/send-whatsapp-monitoring.mjs
 */
import { sendWhatsAppWebhookMessage } from "../lib/whatsapp-webhook.mjs";

function formatJobStatus(result, label) {
  switch (result) {
    case "success":
      return `✅ ${label} OK`;
    case "cancelled":
      return `⚠️ ${label} CANCELLED`;
    default:
      return `❌ ${label} FAIL`;
  }
}

function formatNonBlockingStatus(result, label) {
  switch (result) {
    case "success":
      return `✅ ${label} OK (non-blocking)`;
    case "cancelled":
      return `⚠️ ${label} CANCELLED (non-blocking)`;
    case "skipped":
      return `⚪ ${label} SKIPPED (non-blocking)`;
    default:
      return `⚠️ ${label} FAIL (non-blocking)`;
  }
}

function buildMessage() {
  const prodResult = process.env.PROD_RESULT ?? "unknown";
  const doctorUi = process.env.PROD_DOCTOR_UI_MONITOR_OUTCOME ?? "skipped";
  const runId = process.env.RUN_ID ?? "local";
  const notifyOnly = process.env.NOTIFY_ONLY === "true";
  const extra = (process.env.EXTRA_MESSAGE ?? "").trim();

  if (notifyOnly) {
    let msg = `🧪 DocCy PROD manual WhatsApp test | run ${runId}`;
    if (extra) msg += ` | ${extra}`;
    return msg;
  }

  const prodBlockingOk = prodResult === "success";
  const doctorUiWarning = doctorUi !== "success" && doctorUi !== "skipped";

  let icon = prodBlockingOk ? "✅" : prodResult === "cancelled" ? "⚠️" : "❌";
  if (prodBlockingOk && doctorUiWarning) icon = "⚠️";

  const prodLine = formatJobStatus(prodResult, "Prod nightly");
  const doctorLine = formatNonBlockingStatus(doctorUi, "Doctor login/agenda UI monitor");

  let msg = `${icon} DocCy nightly | ${prodLine} | ${doctorLine} | run ${runId}`;
  if (extra) msg += ` | ${extra}`;
  return msg;
}

async function main() {
  const webhookUrl = (process.env.WHATSAPP_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl) {
    console.error("WHATSAPP_WEBHOOK_URL is empty or missing.");
    process.exit(1);
  }

  const message = buildMessage();
  const runUrl = process.env.RUN_URL ?? "";
  let waHost = "";
  try {
    waHost = new URL(webhookUrl.replace(/\r|\n/g, "")).host;
  } catch {
    waHost = "(invalid URL)";
  }

  console.log("Sending WhatsApp monitoring message…");
  console.log(message);

  const result = await sendWhatsAppWebhookMessage(webhookUrl, message);

  const summaryLines = [
    "## WhatsApp (notify-whatsapp)",
    runUrl ? `- **Run:** ${runUrl}` : null,
    `- **Prod nightly:** ${process.env.PROD_RESULT ?? "?"}`,
    `- **Doctor UI monitor:** ${process.env.PROD_DOCTOR_UI_MONITOR_OUTCOME ?? "?"}`,
    `- **Webhook host:** \`${waHost}\``,
    result.ok
      ? `- **Delivery:** OK (${result.method})`
      : `- **Delivery:** FAILED — ${result.error}`,
  ].filter(Boolean);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join("\n")}\n`);
  }

  if (result.ok) {
    console.log(`Delivered via ${result.method}`);
    process.exit(0);
  }

  console.error(result.error);
  for (const line of result.log) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
