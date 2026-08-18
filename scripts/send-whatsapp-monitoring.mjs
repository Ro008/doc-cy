#!/usr/bin/env node
/**
 * CI / manual: send production monitoring summary via WHATSAPP_WEBHOOK_URL.
 * Usage: node scripts/send-whatsapp-monitoring.mjs
 */
import { sendWhatsAppWebhookMessage } from "../lib/whatsapp-webhook.mjs";
import { buildNightlyWhatsAppMessage } from "../lib/whatsapp-monitoring-message.mjs";

async function main() {
  const webhookUrl = (process.env.WHATSAPP_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl) {
    console.error("WHATSAPP_WEBHOOK_URL is empty or missing.");
    process.exit(1);
  }

  const message = buildNightlyWhatsAppMessage({
    notifyOnly: process.env.NOTIFY_ONLY === "true",
    extra: (process.env.EXTRA_MESSAGE ?? "").trim(),
    runId: process.env.RUN_ID ?? "local",
    emailResult: process.env.EMAIL_RESULT ?? "unknown",
    edgeResult: process.env.EDGE_RESULT ?? process.env.PROD_RESULT ?? "unknown",
    originResult: process.env.ORIGIN_RESULT ?? "skipped",
  });
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
    `- **Email guards:** ${process.env.EMAIL_RESULT ?? "?"}`,
    `- **Edge (mydoccy.com):** ${process.env.EDGE_RESULT ?? process.env.PROD_RESULT ?? "?"}`,
    `- **Origin (Vercel):** ${process.env.ORIGIN_RESULT ?? "?"}`,
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
