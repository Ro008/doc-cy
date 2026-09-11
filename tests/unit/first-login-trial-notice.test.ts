import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstLoginTrialNoticeCopy,
  shouldRedirectFirstLoginToSettings,
  shouldShowFirstLoginTrialNotice,
} from "../../lib/first-login-trial-notice";

describe("shouldShowFirstLoginTrialNotice", () => {
  it("shows only for verified professionals who have not dismissed it", () => {
    assert.equal(
      shouldShowFirstLoginTrialNotice({ status: "verified", trialNoticeSeenAt: null }),
      true,
    );
    assert.equal(
      shouldShowFirstLoginTrialNotice({ status: "verified", trialNoticeSeenAt: "" }),
      true,
    );
    assert.equal(
      shouldShowFirstLoginTrialNotice({
        status: "verified",
        trialNoticeSeenAt: "2026-09-09T12:00:00.000Z",
      }),
      false,
    );
  });

  it("does not show during license review or after rejection", () => {
    assert.equal(
      shouldShowFirstLoginTrialNotice({ status: "pending", trialNoticeSeenAt: null }),
      false,
    );
    assert.equal(
      shouldShowFirstLoginTrialNotice({ status: "rejected", trialNoticeSeenAt: null }),
      false,
    );
  });
});

describe("shouldRedirectFirstLoginToSettings", () => {
  it("matches the welcome-notice signal so first login skips the empty agenda", () => {
    assert.equal(
      shouldRedirectFirstLoginToSettings({
        status: "verified",
        trialNoticeSeenAt: null,
      }),
      true,
    );
    assert.equal(
      shouldRedirectFirstLoginToSettings({
        status: "verified",
        trialNoticeSeenAt: "2026-09-09T12:00:00.000Z",
      }),
      false,
    );
  });
});

describe("firstLoginTrialNoticeCopy", () => {
  it("explains the 6-month trial in English without promising SMS 2FA", () => {
    const standard = firstLoginTrialNoticeCopy(false);
    assert.equal(standard.title, "Welcome to DocCy");
    assert.match(standard.intro, /first 6 months/i);
    assert.equal(standard.founderPrice, null);
    assert.equal(standard.cta, "Got it");
    assert.doesNotMatch(standard.intro, /sms|2fa|two-factor|6-digit|code/i);
  });

  it("adds the Founding Member €19 lock only for founders", () => {
    const founder = firstLoginTrialNoticeCopy(true);
    assert.match(founder.founderPrice ?? "", /€19\/month/);
    assert.match(founder.founderPrice ?? "", /Founding Member/);
    assert.doesNotMatch(founder.founderPrice ?? "", /sms|2fa/i);
  });
});
