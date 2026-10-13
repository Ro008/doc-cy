import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstLoginTrialNoticeCopy,
  shouldRedirectFirstLoginToSettings,
  shouldShowFirstLoginTrialNotice,
} from "../../lib/first-login-trial-notice";

describe("shouldShowFirstLoginTrialNotice", () => {
  it("shows until the professional dismisses it", () => {
    assert.equal(
      shouldShowFirstLoginTrialNotice({ trialNoticeSeenAt: null }),
      true,
    );
    assert.equal(
      shouldShowFirstLoginTrialNotice({ trialNoticeSeenAt: "" }),
      true,
    );
    assert.equal(
      shouldShowFirstLoginTrialNotice({ trialNoticeSeenAt: "2026-09-09T12:00:00.000Z" }),
      false,
    );
  });
});

describe("shouldRedirectFirstLoginToSettings", () => {
  it("matches the welcome-notice signal so first login skips the empty agenda", () => {
    assert.equal(
      shouldRedirectFirstLoginToSettings({ trialNoticeSeenAt: null }),
      true,
    );
    assert.equal(
      shouldRedirectFirstLoginToSettings({ trialNoticeSeenAt: "2026-09-09T12:00:00.000Z" }),
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
