import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INCORRECT_INFO_PROMPT,
  feedbackSentFollowUp,
  hasIncorrectInfoDetails,
  validateFeedbackSubmission,
} from "@/lib/doccy-feedback";

const TEMPLATE = [
  "I'm reporting incorrect information about a Health Finder listing.",
  "",
  "Professional: Petros Marcou",
  "Specialty: Dentist",
  "District: Larnaca",
  "",
  INCORRECT_INFO_PROMPT,
  "",
].join("\n");

describe("hasIncorrectInfoDetails", () => {
  it("rejects the untouched template (the Petros Marcou report)", () => {
    assert.equal(hasIncorrectInfoDetails(TEMPLATE), false);
  });

  it("rejects whitespace-only text under the prompt", () => {
    assert.equal(hasIncorrectInfoDetails(`${TEMPLATE}  \n\t \n`), false);
  });

  it("accepts text written under the prompt", () => {
    assert.equal(hasIncorrectInfoDetails(`${TEMPLATE}The phone number is wrong.`), true);
  });

  it("does not apply to messages that are not the incorrect-info template", () => {
    assert.equal(hasIncorrectInfoDetails("Just a normal question"), true);
  });
});

describe("validateFeedbackSubmission", () => {
  it("accepts a message with a valid email from a visitor", () => {
    assert.equal(
      validateFeedbackSubmission({ message: "Hello", email: "a@b.co", signedIn: false }),
      null,
    );
  });

  it("requires an email from a visitor without a session", () => {
    assert.match(
      validateFeedbackSubmission({ message: "Hello", email: "", signedIn: false }) ?? "",
      /email/i,
    );
    assert.match(
      validateFeedbackSubmission({ message: "Hello", email: "   ", signedIn: false }) ?? "",
      /email/i,
    );
  });

  it("rejects a malformed email", () => {
    assert.match(
      validateFeedbackSubmission({ message: "Hello", email: "not-an-email", signedIn: false }) ?? "",
      /email/i,
    );
  });

  it("does not require an email when signed in", () => {
    assert.equal(
      validateFeedbackSubmission({ message: "Hello", email: "", signedIn: true }),
      null,
    );
  });

  it("still validates an email a signed-in user chose to type", () => {
    assert.match(
      validateFeedbackSubmission({ message: "Hello", email: "oops", signedIn: true }) ?? "",
      /email/i,
    );
  });

  it("rejects an empty message", () => {
    assert.match(
      validateFeedbackSubmission({ message: "  ", email: "a@b.co", signedIn: false }) ?? "",
      /message/i,
    );
  });

  it("rejects the untouched incorrect-info template", () => {
    assert.match(
      validateFeedbackSubmission({ message: TEMPLATE, email: "a@b.co", signedIn: false }) ?? "",
      /what seems incorrect/i,
    );
  });

  it("accepts a filled-in incorrect-info report", () => {
    assert.equal(
      validateFeedbackSubmission({
        message: `${TEMPLATE}Wrong clinic address.`,
        email: "a@b.co",
        signedIn: false,
      }),
      null,
    );
  });
});

describe("feedbackSentFollowUp", () => {
  it("promises a follow-up only when we can reach the sender", () => {
    assert.match(feedbackSentFollowUp(true), /follow up/i);
  });

  it("does not promise a reply when there is no email", () => {
    assert.doesNotMatch(feedbackSentFollowUp(false), /follow up|reply|get back/i);
  });
});
