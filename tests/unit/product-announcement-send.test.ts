import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ANNOUNCEMENT_FROM,
  ANNOUNCEMENT_REPLY_TO,
  MAX_RECIPIENTS_WITHOUT_FLAG,
  buildAnnouncementMessage,
  parseRecipients,
  parseSendArgs,
  planSend,
} from "../../lib/product-announcement-send";
import { ANNOUNCEMENT_FEATURES } from "../../lib/product-announcement-email";

const SITE = "https://www.mydoccy.com";
const fakeGif = (file: string) => Buffer.from(`GIF89a-${file}`);

describe("parseSendArgs", () => {
  it("is a dry run unless --send is given, and needs exactly one of --to or --recipients", () => {
    const test = parseSendArgs(["--to", "me@example.com"]);
    assert.equal(test.send, false);
    assert.equal(test.to, "me@example.com");
    assert.equal(test.siteUrl, SITE);
    assert.equal(test.inlineImages, false);
    assert.equal(parseSendArgs(["--to", "me@example.com", "--send"]).send, true);
    assert.equal(parseSendArgs(["--recipients", "people.json"]).recipientsFile, "people.json");
    assert.throws(() => parseSendArgs([]), /--to|--recipients/);
    assert.throws(() => parseSendArgs(["--to", "a@b.com", "--recipients", "x.json"]), /only one/i);
  });

  it("reads the name, the inline-images test mode and the site address", () => {
    const args = parseSendArgs(["--to", "me@example.com", "--name", "Rocío", "--inline-images", "--site", "http://localhost:3100/"]);
    assert.equal(args.name, "Rocío");
    assert.equal(args.inlineImages, true);
    assert.equal(args.siteUrl, "http://localhost:3100");
  });

  it("refuses an unknown flag and a flag with no value, so a typo never sends", () => {
    assert.throws(() => parseSendArgs(["--to", "a@b.com", "--sned"]), /unknown/i);
    assert.throws(() => parseSendArgs(["--to"]), /value/i);
  });
});

describe("parseRecipients", () => {
  it("accepts a list of {email, firstName}, trims, lowercases and drops repeats", () => {
    const list = parseRecipients([
      { email: " Elena@Example.com ", firstName: " Elena " },
      { email: "elena@example.com", firstName: "Elena again" },
      { email: "nikos@example.com" },
    ]);
    assert.deepEqual(list, [
      { email: "elena@example.com", firstName: "Elena" },
      { email: "nikos@example.com", firstName: null },
    ]);
  });

  it("refuses anything that is not a non-empty list of valid addresses", () => {
    assert.throws(() => parseRecipients({}), /list/i);
    assert.throws(() => parseRecipients([]), /empty|no recipients/i);
    assert.throws(() => parseRecipients([{ email: "not-an-email" }]), /not-an-email/);
    assert.throws(() => parseRecipients([{ firstName: "No email" }]), /email/i);
  });
});

describe("buildAnnouncementMessage", () => {
  const recipient = { email: "elena@example.com", firstName: "Elena" };

  it("is sent from hello@ with replies going to hello@, to one person, tagged", () => {
    const message = buildAnnouncementMessage({ siteUrl: SITE, recipient, inlineImages: false, readGif: fakeGif });
    assert.equal(message.from, ANNOUNCEMENT_FROM);
    assert.equal(ANNOUNCEMENT_FROM, "DocCy <hello@mydoccy.com>");
    assert.deepEqual(message.replyTo, [ANNOUNCEMENT_REPLY_TO]);
    assert.equal(ANNOUNCEMENT_REPLY_TO, "hello@mydoccy.com");
    assert.deepEqual(message.to, ["elena@example.com"]);
    assert.match(message.subject, /what's new in doccy/i);
    assert.match(message.html, /Hi Elena,/);
    assert.deepEqual(message.tags, [{ name: "type", value: "product-announcement" }]);
    assert.equal(message.attachments, undefined);
  });

  it("normally shows the animations from the site", () => {
    const { html } = buildAnnouncementMessage({ siteUrl: SITE, recipient, inlineImages: false, readGif: fakeGif });
    for (const feature of ANNOUNCEMENT_FEATURES) {
      assert.ok(html.includes(`src="${SITE}/email/${feature.gif.file}"`), feature.id);
    }
  });

  it("in the test mode attaches the animations inline and points the email at them", () => {
    const { html, attachments } = buildAnnouncementMessage({ siteUrl: SITE, recipient, inlineImages: true, readGif: fakeGif });
    assert.equal(attachments?.length, ANNOUNCEMENT_FEATURES.length);
    for (const feature of ANNOUNCEMENT_FEATURES) {
      const id = feature.gif.file.replace(/\.gif$/, "");
      assert.ok(html.includes(`src="cid:${id}"`), `${feature.id} uses cid`);
      assert.ok(!html.includes(`${SITE}/email/${feature.gif.file}`), `${feature.id} no longer hosted`);
      const attachment = attachments!.find((a) => a.contentId === id);
      assert.ok(attachment, `${feature.id} attachment`);
      assert.equal(attachment.filename, feature.gif.file);
      assert.equal(attachment.contentType, "image/gif");
      assert.ok(Buffer.isBuffer(attachment.content));
      assert.equal((attachment.content as Buffer).toString(), `GIF89a-${feature.gif.file}`);
    }
  });

  it("subject and plain text do not change with the test mode", () => {
    const a = buildAnnouncementMessage({ siteUrl: SITE, recipient, inlineImages: false, readGif: fakeGif });
    const b = buildAnnouncementMessage({ siteUrl: SITE, recipient, inlineImages: true, readGif: fakeGif });
    assert.equal(a.subject, b.subject);
    assert.equal(a.text, b.text);
  });
});

describe("planSend", () => {
  const people = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `p${i}@example.com`, firstName: null }));

  it("is a dry run by default and a send only with --send", () => {
    assert.equal(planSend(parseSendArgs(["--to", "a@b.com"]), people(1)).mode, "dry-run");
    assert.equal(planSend(parseSendArgs(["--to", "a@b.com", "--send"]), people(1)).mode, "send");
  });

  it("stops a list longer than the limit unless --allow-many says it is meant", () => {
    const many = people(MAX_RECIPIENTS_WITHOUT_FLAG + 1);
    assert.throws(() => planSend(parseSendArgs(["--recipients", "x.json", "--send"]), many), /allow-many/);
    assert.equal(planSend(parseSendArgs(["--recipients", "x.json", "--send", "--allow-many"]), many).recipients.length, many.length);
    assert.equal(planSend(parseSendArgs(["--recipients", "x.json", "--send"]), people(MAX_RECIPIENTS_WITHOUT_FLAG)).recipients.length, MAX_RECIPIENTS_WITHOUT_FLAG);
  });

  it("never sends the test mode (inline images) to a list: that mode is for one address", () => {
    assert.throws(
      () => planSend(parseSendArgs(["--recipients", "x.json", "--send", "--inline-images"]), people(3)),
      /inline-images/,
    );
  });
});
