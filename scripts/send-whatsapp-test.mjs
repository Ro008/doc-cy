#!/usr/bin/env node
/**
 * Local manual test: WHATSAPP_WEBHOOK_URL="..." node scripts/send-whatsapp-test.mjs "Hello"
 */
import { sendWhatsAppWebhookMessage } from "../lib/whatsapp-webhook.mjs";

const webhookUrl = (process.env.WHATSAPP_WEBHOOK_URL ?? "").trim();
const text = process.argv.slice(2).join(" ").trim() || "DocCy WhatsApp webhook test";

if (!webhookUrl) {
  console.error("Set WHATSAPP_WEBHOOK_URL (or FOUNDER_REGISTRATION_WHATSAPP_WEBHOOK_URL).");
  process.exit(1);
}

const result = await sendWhatsAppWebhookMessage(webhookUrl, text);
if (result.ok) {
  console.log(`OK (${result.method})`);
  process.exit(0);
}

console.error(result.error);
for (const line of result.log) console.error(`  ${line}`);
process.exit(1);
