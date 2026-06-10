#!/usr/bin/env node
/**
 * One-off / idempotent: add Playwright describe tags for CI lanes.
 * See tests/helpers/ciTags.ts and docs/ci-test-policy.md
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "tests");

const prE2e = [
  "blog_single_image_ui.spec.ts",
  "landing_i18n.spec.ts",
  "integration/appointments_race_condition.integration.spec.ts",
  "integration/settings_clinic_address_notice.integration.spec.ts",
  "integration/finder_critical.integration.spec.ts",
  "integration/needs_reschedule_slot_free.integration.spec.ts",
  "navigation.spec.ts",
  "feedback_support_modal.spec.ts",
  "promote_practice_settings.spec.ts",
  "practice_insights.spec.ts",
  "practice_insights_metrics.spec.ts",
  "agenda_auth.spec.ts",
  "integration/monthly_digest.integration.spec.ts",
  "integration/doctor_account_access.integration.spec.ts",
  "navigation_feedback.spec.ts",
  "doctor_settings_language_guard.spec.ts",
  "profile_structured_data.spec.ts",
  "schedule_constraints.spec.ts",
  "integration/finder_user_behaviors.integration.spec.ts",
  "booking_flow.spec.ts",
  "manual_booking_flow.spec.ts",
  "manual_booking_modal_ux.spec.ts",
  "integration/doctor_confirmation_flow.integration.spec.ts",
  "integration/propose_reschedule_confirmed.integration.spec.ts",
  "integration/directory_duplicates_actions.integration.spec.ts",
  "doctor_password_login_form.spec.ts",
];

const prEmail = [
  "integration/agenda_multisession_sync.integration.spec.ts",
  "integration/agenda_visit_reason.integration.spec.ts",
  "integration/reschedule_email_content.integration.spec.ts",
];

const prPreviewNightly = ["prod/prod_site_availability.spec.ts"];
const nightlyProdOnly = [
  "prod/prod_appointment_booking_flow.spec.ts",
  "prod/prod_registration_smoke.spec.ts",
];
function tagExpr(tags) {
  if (tags.length === 1) return `"${tags[0]}"`;
  return `[${tags.map((t) => `"${t}"`).join(", ")}]`;
}

function applyTag(filePath, tags) {
  const abs = path.join(root, filePath);
  if (!fs.existsSync(abs)) {
    console.warn("skip missing", filePath);
    return;
  }
  let content = fs.readFileSync(abs, "utf8");
  for (const t of tags) {
    if (content.includes(t)) {
      console.log("already tagged", filePath, t);
      return;
    }
  }
  const expr = tagExpr(tags);
  const re = /test\.describe\((['"`])([\s\S]*?)\1,\s*\(\)\s*=>\s*\{/;
  if (!re.test(content)) {
    console.warn("no describe match", filePath);
    return;
  }
  content = content.replace(
    re,
    `test.describe($1$2$1, { tag: ${expr} }, () => {`
  );
  fs.writeFileSync(abs, content);
  console.log("tagged", filePath, expr);
}

for (const f of prE2e) {
  const tags =
    f === "integration/doctor_confirmation_flow.integration.spec.ts"
      ? ["@pr-e2e", "@pr-mobile-monitor"]
      : ["@pr-e2e"];
  applyTag(f, tags);
}
for (const f of prEmail) applyTag(f, ["@pr-email"]);
for (const f of prPreviewNightly) applyTag(f, ["@pr-preview", "@nightly-prod"]);
for (const f of nightlyProdOnly) applyTag(f, ["@nightly-prod"]);
