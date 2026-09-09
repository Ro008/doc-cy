import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTER_SUBMIT_WAIT_BEATS,
  registerSubmitWaitBeatAt,
  registerSubmitWaitProgressPercent,
} from "../../lib/register-submit-wait";

describe("register submit wait copy", () => {
  it("walks through account, clinic, and confirmation email before the last hold", () => {
    assert.equal(registerSubmitWaitBeatAt(0).title, "Creating your account");
    assert.equal(registerSubmitWaitBeatAt(2500).title, "Saving your clinic");
    assert.equal(registerSubmitWaitBeatAt(5000).title, "Writing your confirmation email");
    assert.match(registerSubmitWaitBeatAt(5000).detail, /one click/i);
    assert.match(registerSubmitWaitBeatAt(5000).detail, /not a code/i);
    assert.equal(registerSubmitWaitBeatAt(20_000).title, REGISTER_SUBMIT_WAIT_BEATS.at(-1)?.title);
  });

  it("never claims the wait is finished", () => {
    assert.ok(registerSubmitWaitProgressPercent(0) < 30);
    assert.ok(registerSubmitWaitProgressPercent(30_000) <= 90);
  });
});
