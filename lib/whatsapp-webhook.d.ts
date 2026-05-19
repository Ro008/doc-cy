export function normalizeWebhookUrl(webhookUrl: string): URL;

export type WhatsAppWebhookSendResult =
  | { ok: true; method: string }
  | { ok: false; error: string; log: string[] };

export function sendWhatsAppWebhookMessage(
  webhookUrl: string,
  text: string,
  options?: { attempts?: number }
): Promise<WhatsAppWebhookSendResult>;
