import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INTERNAL_DASHBOARD_TABS,
  internalDashboardTab,
  internalDashboardTabHref,
} from "../../lib/internal-dashboard-tab";

/**
 * /internal/directory has two tabs until the internal site gets its own design:
 * "Requests" (the review queue, the default) and "Statistics" (everything else).
 */
describe("internalDashboardTab", () => {
  it("opens Requests unless Statistics is asked for", () => {
    assert.equal(internalDashboardTab(undefined), "requests");
    assert.equal(internalDashboardTab("requests"), "requests");
    assert.equal(internalDashboardTab("statistics"), "statistics");
    assert.equal(internalDashboardTab(["statistics"]), "statistics");
    assert.equal(internalDashboardTab("nonsense"), "requests");
  });

  it("links each tab by its query", () => {
    assert.equal(internalDashboardTabHref("requests"), "/internal/directory?tab=requests");
    assert.equal(internalDashboardTabHref("statistics"), "/internal/directory?tab=statistics");
    assert.deepEqual(
      INTERNAL_DASHBOARD_TABS.map((t) => t.label),
      ["Requests", "Statistics"],
    );
  });
});
