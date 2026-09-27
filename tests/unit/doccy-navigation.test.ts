import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  beginLinkNavigationPending,
  clearNavigationPending,
  getNavigationPendingKey,
  hrefMatchesCurrentLocation,
  shouldStartLinkNavigationPending,
} from "@/lib/doccy-navigation";

describe("hrefMatchesCurrentLocation", () => {
  it("does not start pending when href is already the current location", () => {
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", "page=3"), true);
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", "page=2"), false);
    assert.equal(hrefMatchesCurrentLocation("/?page=3", "/", ""), false);
    assert.equal(shouldStartLinkNavigationPending("/?page=3", "/", "page=3"), false);
    assert.equal(shouldStartLinkNavigationPending("/?page=4", "/", "page=3"), true);
  });

  it("compares pathname and search independently", () => {
    assert.equal(
      hrefMatchesCurrentLocation("/limassol/dentistry?page=2", "/limassol/dentistry", "page=2"),
      true,
    );
    assert.equal(
      hrefMatchesCurrentLocation("/limassol/dentistry?page=2", "/paphos/dentistry", "page=2"),
      false,
    );
  });
});

describe("beginLinkNavigationPending", () => {
  const globals = globalThis as { window?: unknown };
  let hadWindow = false;

  beforeEach(() => {
    hadWindow = "window" in globals;
    if (!hadWindow) globals.window = new EventTarget();
    clearNavigationPending();
  });

  afterEach(() => {
    clearNavigationPending();
    if (!hadWindow) delete globals.window;
  });

  it("marks the clicked link pending when it leads somewhere else", () => {
    assert.equal(beginLinkNavigationPending("/agenda/settings", "/agenda", ""), true);
    assert.equal(getNavigationPendingKey(), "/agenda/settings");
  });

  it("clears another link's pending state when the current page is clicked", () => {
    // Settings clicked, then My Agenda while still on /agenda: router.push("/agenda")
    // supersedes the Settings navigation, the pathname never changes, and Settings
    // used to stay disabled with a spinner until reload.
    beginLinkNavigationPending("/agenda/settings", "/agenda", "");
    assert.equal(beginLinkNavigationPending("/agenda", "/agenda", ""), false);
    assert.equal(getNavigationPendingKey(), null);
  });
});
