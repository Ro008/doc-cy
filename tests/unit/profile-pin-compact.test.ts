import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextPinCompact } from "../../lib/public/profile-pin-compact";

/**
 * On a wide page the hero stays on screen and shrinks after the first scroll (2026-10-14).
 * On a profile only a little taller than the screen, shrinking it made the page fit: the
 * scroll went back to the top, the hero grew again, and the end of the page could never be
 * reached (CI, andreas-nikos, 2026-10-15). It shrinks only when the page keeps enough room.
 */
const tall = { stuck: true, room: 2000, pinHeight: 280 };

describe("nextPinCompact", () => {
  it("shrinks past 24px of scroll and grows back near the top, with a band in between", () => {
    assert.equal(nextPinCompact({ ...tall, y: 30, wasCompact: false }), true);
    assert.equal(nextPinCompact({ ...tall, y: 10, wasCompact: false }), false);
    assert.equal(nextPinCompact({ ...tall, y: 10, wasCompact: true }), true);
    assert.equal(nextPinCompact({ ...tall, y: 2, wasCompact: true }), false);
  });

  it("never shrinks when the hero is not pinned (a phone)", () => {
    assert.equal(nextPinCompact({ ...tall, stuck: false, y: 500, wasCompact: true }), false);
  });

  it("keeps the full hero on a page without room for it to shrink", () => {
    // 109px of scroll and a 277px hero: shrunk, the page would fit the screen.
    const short = { stuck: true, room: 109, pinHeight: 277 };
    assert.equal(nextPinCompact({ ...short, y: 109, wasCompact: false }), false);
    // Room for the hero and the 24px after it: it shrinks.
    assert.equal(nextPinCompact({ stuck: true, room: 302, pinHeight: 277, y: 30, wasCompact: false }), true);
    assert.equal(nextPinCompact({ stuck: true, room: 301, pinHeight: 277, y: 30, wasCompact: false }), false);
  });

  it("stays shrunk once shrunk: the room is then measured with the smaller hero", () => {
    assert.equal(nextPinCompact({ stuck: true, room: 60, pinHeight: 120, y: 60, wasCompact: true }), true);
  });
});
