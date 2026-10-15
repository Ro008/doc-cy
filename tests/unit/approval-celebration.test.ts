import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { approvalCelebration } from "../../lib/approval-celebration";
import {
  CONFETTI_COLORS,
  CONFETTI_GRAVITY,
  confettiAlpha,
  createConfettiBurst,
  stepConfetti,
  type ConfettiParticle,
} from "../../lib/confetti";

/**
 * Approving a professional's registration is a celebration (user, 2026-10-15): a dialog
 * with confetti cannons from both bottom corners, the name, the specialty and district,
 * and a link to the new public profile. It is one approval a day at most, so it can stop
 * the founder for a click; no counters. Denying stays as quiet as before.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const details = (over: Record<string, unknown> = {}) =>
  ({
    first_name: "Elena",
    last_name: "Christou",
    specialties: [{ name: "Cardiology" }, { name: "Internal medicine" }],
    clinics: [{ district: "Limassol" }, { district: "Nicosia" }],
    ...over,
  }) as Parameters<typeof approvalCelebration>[0]["details"];

describe("approvalCelebration", () => {
  it("names the professional, the first specialty and the first clinic's district", () => {
    assert.deepEqual(approvalCelebration({ details: details(), slug: "elena-christou" }), {
      title: "Elena Christou is now on DocCy",
      detail: "Cardiology · Limassol",
      profilePath: "/en/elena-christou",
    });
  });

  it("leaves out what the request doesn't have", () => {
    const noDistrict = approvalCelebration({ details: details({ clinics: [{ district: " " }] }), slug: "e" });
    assert.equal(noDistrict.detail, "Cardiology");
    const nothing = approvalCelebration({ details: details({ specialties: [], clinics: [] }), slug: "e" });
    assert.equal(nothing.detail, "");
  });

  it("has no profile link without a slug", () => {
    assert.equal(approvalCelebration({ details: details(), slug: null }).profilePath, null);
    assert.equal(approvalCelebration({ details: details(), slug: "  " }).profilePath, null);
  });

  it("still has a title when the name is blank", () => {
    const { title } = approvalCelebration({ details: details({ first_name: " ", last_name: "" }), slug: "e" });
    assert.equal(title, "The profile is now on DocCy");
  });
});

const particle = (over: Partial<ConfettiParticle> = {}): ConfettiParticle => ({
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  w: 6,
  h: 4,
  rotation: 0,
  spin: 0,
  color: CONFETTI_COLORS[0],
  age: 0,
  life: 100,
  phase: 0,
  round: false,
  ...over,
});

describe("createConfettiBurst", () => {
  it("makes the requested number of particles at the origin, in the palette", () => {
    const burst = createConfettiBurst(40, { x: 10, y: 300 }, { angle: -Math.PI / 2, spread: 1, speed: 10 });
    assert.equal(burst.length, 40);
    for (const p of burst) {
      assert.equal(p.x, 10);
      assert.equal(p.y, 300);
      assert.ok(CONFETTI_COLORS.includes(p.color as (typeof CONFETTI_COLORS)[number]));
      assert.ok(p.life > 0 && p.age === 0);
    }
  });

  it("aims along the angle: a cannon pointing up throws particles up", () => {
    const burst = createConfettiBurst(30, { x: 0, y: 0 }, { angle: -Math.PI / 2, spread: 0.2, speed: 10 });
    assert.ok(burst.every((p) => p.vy < 0));
  });

  it("is repeatable with the same random numbers", () => {
    const seq = () => {
      let n = 0;
      return () => ((n += 0.137) % 1);
    };
    const a = createConfettiBurst(10, { x: 1, y: 2 }, { angle: 0, spread: 1, speed: 5 }, seq());
    const b = createConfettiBurst(10, { x: 1, y: 2 }, { angle: 0, spread: 1, speed: 5 }, seq());
    assert.deepEqual(a, b);
  });
});

describe("stepConfetti", () => {
  it("moves a particle, pulls it down and ages it", () => {
    const [next] = stepConfetti([particle({ vx: 2, vy: -5 })], 600);
    assert.ok(next.x > 100);
    assert.ok(next.y < 100);
    assert.ok(Math.abs(next.vy - (-5 + CONFETTI_GRAVITY)) < 1, "gravity pulls it down, a little drag allowed");
    assert.ok(next.vy > -5);
    assert.equal(next.age, 1);
  });

  it("does not change the particles it was given", () => {
    const original = particle({ vy: -3 });
    stepConfetti([original], 600);
    assert.equal(original.age, 0);
    assert.equal(original.y, 100);
  });

  it("drops particles that are out of life or far below the canvas", () => {
    const kept = particle();
    const old = particle({ age: 100, life: 100 });
    const fallen = particle({ y: 700 });
    assert.equal(stepConfetti([kept, old, fallen], 600).length, 1);
  });
});

describe("confettiAlpha", () => {
  it("is opaque for most of a particle's life and fades out at the end", () => {
    assert.equal(confettiAlpha(particle({ age: 10, life: 100 })), 1);
    const fading = confettiAlpha(particle({ age: 90, life: 100 }));
    assert.ok(fading > 0 && fading < 1);
    assert.equal(confettiAlpha(particle({ age: 150, life: 100 })), 0);
  });
});

describe("where the celebration is wired", () => {
  const section = read("components/internal/RegistrationRequestsSection.tsx");
  const dialog = read("components/internal/ApprovalCelebration.tsx");

  it("opens after an approval, with the slug the approve API returned", () => {
    assert.match(section, /import \{ ApprovalCelebration \}/);
    assert.match(section, /approvalCelebration\(\{ details, slug: json\.slug/);
    assert.match(section, /<ApprovalCelebration/);
  });

  it("a denial does not celebrate", () => {
    const deny = section.slice(section.indexOf("async function deny"), section.indexOf("async function deny") + 900);
    assert.doesNotMatch(deny, /celebrat/i);
  });

  it("is an accessible dialog: named, modal, closes with Escape, the backdrop or Done", () => {
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /aria-labelledby/);
    assert.match(dialog, /"Escape"/);
    assert.match(dialog, />\s*Done\s*</);
    assert.match(dialog, /Open profile/);
  });

  it("keeps still for people who asked the system to reduce motion", () => {
    assert.match(dialog, /prefers-reduced-motion: reduce/);
  });

  it("has no counters (one approval a day at most)", () => {
    assert.doesNotMatch(dialog, /approved today|professionals live/i);
  });
});
