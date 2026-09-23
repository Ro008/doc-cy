import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("register wizard wiring", () => {
  it("uses the 3-step wizard with first and last name fields", () => {
    const source = fs.readFileSync(path.join(repoRoot, "app/register/page.tsx"), "utf8");
    assert.match(source, /RegisterWizard/);
    assert.match(source, /name="firstName"/);
    assert.match(source, /name="lastName"/);
    assert.doesNotMatch(source, /name="fullName"/);
    // Step 1 radio questions (UI only for now: the server action does not store them yet).
    assert.match(source, /name="gender"/);
    assert.match(source, /name="gesy"/);
    // Split layout: wizard on the left, benefits showcase on the right (desktop).
    assert.match(source, /lg:grid-cols/);
    assert.doesNotMatch(source, /RegisterPromoBanner/);
    assert.doesNotMatch(source, /RegisterDemoAside/);
  });

  it("scrolls the wizard only when the step changes, and animates incoming steps", () => {
    const wizard = fs.readFileSync(
      path.join(repoRoot, "components/auth/RegisterWizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /scrollRegisterWizardToTop/);
    assert.match(wizard, /previousStepRef/);
    assert.match(wizard, /previousStepRef\.current === step/);
    assert.match(wizard, /register-step-in/);
  });

  it("renders the steps as an accordion: done steps collapse to a summary with Edit", () => {
    const wizard = fs.readFileSync(
      path.join(repoRoot, "components/auth/RegisterWizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /data-register-step-card/);
    assert.match(wizard, />\s*Edit\s*</);
    assert.match(wizard, /registerAccountSummary/);
    assert.match(wizard, /registerProfileSummary/);
    assert.match(wizard, /Continue to profile/);
    assert.match(wizard, /Continue to practice/);
    // One Continue button at a time (Playwright strict mode + screen readers).
    assert.equal((wizard.match(/data-testid="register-wizard-continue"/g) ?? []).length, 1);
  });
});
