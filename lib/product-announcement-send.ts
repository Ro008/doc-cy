import { ANNOUNCEMENT_FEATURES, buildProductAnnouncementEmailContent } from "@/lib/product-announcement-email";

/**
 * The logic behind scripts/announcement-email/send.ts, kept apart so it is tested: who the
 * "what's new" email is from, what a recipient's message looks like, and the guards that stop a typo
 * or a wrong list from sending to people it should not. The script only reads files and calls Resend.
 */

/** Sending-only address on the verified domain; replies reach doccyteam through Cloudflare Email Routing. */
export const ANNOUNCEMENT_FROM = "DocCy <hello@mydoccy.com>";
export const ANNOUNCEMENT_REPLY_TO = "hello@mydoccy.com";
export const DEFAULT_SITE_URL = "https://www.mydoccy.com";
/** More recipients than this needs --allow-many: today the list is a handful of professionals. */
export const MAX_RECIPIENTS_WITHOUT_FLAG = 10;

export type SendArgs = {
  send: boolean;
  to?: string;
  name?: string;
  recipientsFile?: string;
  inlineImages: boolean;
  allowMany: boolean;
  siteUrl: string;
};

export type Recipient = { email: string; firstName: string | null };

const VALUE_FLAGS = new Set(["--to", "--name", "--recipients", "--site"]);
const BOOLEAN_FLAGS = new Set(["--send", "--inline-images", "--allow-many"]);

export function parseSendArgs(argv: readonly string[]): SendArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (BOOLEAN_FLAGS.has(arg)) {
      flags.add(arg);
    } else if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      values.set(arg, value);
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  const to = values.get("--to");
  const recipientsFile = values.get("--recipients");
  if (!to && !recipientsFile) throw new Error("Give --to <address> or --recipients <file.json>");
  if (to && recipientsFile) throw new Error("Use only one of --to and --recipients");
  return {
    send: flags.has("--send"),
    to,
    name: values.get("--name"),
    recipientsFile,
    inlineImages: flags.has("--inline-images"),
    allowMany: flags.has("--allow-many"),
    siteUrl: (values.get("--site") ?? DEFAULT_SITE_URL).replace(/\/+$/, ""),
  };
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** A JSON list of `{ email, firstName? }`: trimmed, lowercased, no repeats; anything odd stops the run. */
export function parseRecipients(json: unknown): Recipient[] {
  if (!Array.isArray(json)) throw new Error("The recipients file must hold a list");
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const item of json) {
    const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
    if (!email) throw new Error(`A recipient has no email: ${JSON.stringify(item)}`);
    if (!EMAIL.test(email)) throw new Error(`Not a valid email: ${email}`);
    if (seen.has(email)) continue;
    seen.add(email);
    const firstName = typeof item.firstName === "string" && item.firstName.trim() ? item.firstName.trim() : null;
    out.push({ email, firstName });
  }
  if (out.length === 0) throw new Error("The recipients list is empty: no recipients");
  return out;
}

export type AnnouncementMessage = {
  from: string;
  to: string[];
  replyTo: string[];
  subject: string;
  html: string;
  text: string;
  tags: { name: string; value: string }[];
  attachments?: { filename: string; content: string; contentType: string; contentId: string }[];
};

/**
 * One recipient's message. With `inlineImages` (a test to your own address, before the animations are
 * on the site) they travel inside the email; otherwise they load from `${siteUrl}/email/`.
 */
export function buildAnnouncementMessage(opts: {
  siteUrl: string;
  recipient: Recipient;
  inlineImages: boolean;
  readGif: (file: string) => Buffer;
}): AnnouncementMessage {
  const { subject, text, html } = buildProductAnnouncementEmailContent({
    siteUrl: opts.siteUrl,
    firstName: opts.recipient.firstName,
  });
  const base = {
    from: ANNOUNCEMENT_FROM,
    to: [opts.recipient.email],
    replyTo: [ANNOUNCEMENT_REPLY_TO],
    subject,
    text,
    tags: [{ name: "type", value: "product-announcement" }],
  };
  if (!opts.inlineImages) return { ...base, html };

  let inlineHtml = html;
  const attachments = ANNOUNCEMENT_FEATURES.map((feature) => {
    const contentId = feature.gif.file.replace(/\.gif$/, "");
    inlineHtml = inlineHtml.split(`src="${opts.siteUrl}/email/${feature.gif.file}"`).join(`src="cid:${contentId}"`);
    return {
      filename: feature.gif.file,
      // base64 text: with a Buffer the Resend SDK (6.9.4) waits until it times out.
      content: opts.readGif(feature.gif.file).toString("base64"),
      contentType: "image/gif",
      contentId,
    };
  });
  return { ...base, html: inlineHtml, attachments };
}

export function planSend(args: SendArgs, recipients: readonly Recipient[]) {
  if (args.inlineImages && recipients.length > 1) {
    throw new Error("--inline-images is a test mode for one address: do not use it for a list");
  }
  if (recipients.length > MAX_RECIPIENTS_WITHOUT_FLAG && !args.allowMany) {
    throw new Error(
      `${recipients.length} recipients is more than ${MAX_RECIPIENTS_WITHOUT_FLAG}: add --allow-many if that is meant`,
    );
  }
  return { mode: args.send ? ("send" as const) : ("dry-run" as const), recipients };
}
