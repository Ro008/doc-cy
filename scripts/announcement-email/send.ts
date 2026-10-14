// Sends the "what's new" email. It does nothing but print the plan unless --send is given.
//
//   # look at what would happen (nothing is sent)
//   npx tsx scripts/announcement-email/send.ts --to me@example.com --name Rocio
//   # a real test to one address, animations inside the email (before they are on the site)
//   RESEND_API_KEY=... npx tsx scripts/announcement-email/send.ts --to me@example.com --name Rocio --inline-images --send
//   # the real send: a JSON list [{ "email": "...", "firstName": "..." }], kept out of git
//   RESEND_API_KEY=... npx tsx scripts/announcement-email/send.ts --recipients announcement-out/recipients.json --send
//
// RESEND_API_KEY is read from the environment only, never from a file, so no run uses a key by accident.
// See README.md in this folder.

import fs from "node:fs";
import path from "node:path";

import { Resend } from "resend";

import {
  buildAnnouncementMessage,
  parseRecipients,
  parseSendArgs,
  planSend,
} from "../../lib/product-announcement-send";

const PAUSE_MS = 650; // Resend allows two requests a second.

async function main() {
  const args = parseSendArgs(process.argv.slice(2));
  const recipients = args.to
    ? parseRecipients([{ email: args.to, firstName: args.name }])
    : parseRecipients(JSON.parse(fs.readFileSync(path.resolve(args.recipientsFile!), "utf8")));
  const plan = planSend(args, recipients);
  const readGif = (file: string) => fs.readFileSync(path.resolve("public", "email", file));

  const messages = plan.recipients.map((recipient) =>
    buildAnnouncementMessage({ siteUrl: args.siteUrl, recipient, inlineImages: args.inlineImages, readGif }),
  );

  console.log(`${plan.mode === "send" ? "SENDING" : "DRY RUN"}: ${messages.length} message(s) from ${messages[0].from}`);
  console.log(`Subject: ${messages[0].subject}`);
  console.log(`Animations: ${args.inlineImages ? "inside the email (test mode)" : `from ${args.siteUrl}/email/`}`);
  for (const message of messages) console.log(`  to ${message.to[0]}  (reply-to ${message.replyTo[0]})`);

  if (plan.mode === "dry-run") {
    console.log("\nNothing was sent. Add --send to send.");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("Set RESEND_API_KEY in the environment to send");
  const resend = new Resend(apiKey);

  let failed = 0;
  for (const message of messages) {
    const { data, error } = await resend.emails.send(message);
    if (error) {
      failed += 1;
      console.log(`  FAILED ${message.to[0]}: ${error.message}`);
    } else {
      console.log(`  sent   ${message.to[0]}  id ${data?.id}`);
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log(failed === 0 ? "\nAll sent." : `\n${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
