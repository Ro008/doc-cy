import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCTOR_HOME_PATH,
  logoHomeHref,
  showSectionsInAccountMenu,
  accountMenuItems,
  DOCTOR_NAV_TABS,
  INSIGHTS_ENABLED,
  activeDoctorNavTab,
  isDoctorProductPath,
  pendingBadgeLabel,
  postLoginDestination,
  selectedDoctorNavTab,
} from "../../lib/doctor-routes";

describe("DOCTOR_HOME_PATH", () => {
  it("is the dashboard", () => {
    assert.equal(DOCTOR_HOME_PATH, "/dashboard");
  });
});

describe("postLoginDestination", () => {
  it("lands on the dashboard when there is no next path", () => {
    assert.equal(postLoginDestination(null), "/dashboard");
    assert.equal(postLoginDestination(undefined), "/dashboard");
  });

  it("keeps an explicit next path", () => {
    assert.equal(postLoginDestination("/agenda/settings"), "/agenda/settings");
    assert.equal(
      postLoginDestination("/dashboard/appointments/abc"),
      "/dashboard/appointments/abc",
    );
  });
});

describe("DOCTOR_NAV_TABS", () => {
  // Insights is hidden until there are enough appointments and traffic to make it
  // worth reading (user, 2026-10-12). Its page and code stay; INSIGHTS_ENABLED brings it back.
  it("lists dashboard, agenda, visits and settings in that order: Insights is hidden for now", () => {
    assert.equal(INSIGHTS_ENABLED, false);
    assert.deepEqual(
      DOCTOR_NAV_TABS.map((tab) => [tab.id, tab.label, tab.href]),
      [
        ["dashboard", "Dashboard", "/dashboard"],
        ["agenda", "Agenda", "/agenda"],
        ["visits", "Visits", "/agenda/visits"],
        // Settings is its own page, not under the agenda (settings redesign, 2026-09-30).
        ["settings", "Settings", "/settings"],
      ],
    );
  });
});

describe("activeDoctorNavTab", () => {
  it("matches each tab, with or without a trailing slash", () => {
    assert.equal(activeDoctorNavTab("/dashboard"), "dashboard");
    assert.equal(activeDoctorNavTab("/dashboard/"), "dashboard");
    assert.equal(activeDoctorNavTab("/agenda"), "agenda");
    assert.equal(activeDoctorNavTab("/agenda/"), "agenda");
    assert.equal(activeDoctorNavTab("/settings"), "settings");
    assert.equal(activeDoctorNavTab("/settings/"), "settings");
    assert.equal(activeDoctorNavTab("/agenda/insights"), "insights");
    assert.equal(activeDoctorNavTab("/agenda/visits"), "visits");
    assert.equal(activeDoctorNavTab("/agenda/visits/"), "visits");
  });

  it("returns null outside the tabbed doctor pages", () => {
    for (const path of [
      "/",
      "/login",
      "/agenda/account-review",
      "/dashboard/appointments/abc",
      "/dashboardx",
      "/for-professionals",
    ]) {
      assert.equal(activeDoctorNavTab(path), null, path);
    }
  });
});

describe("isDoctorProductPath", () => {
  it("covers the dashboard and every agenda route", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/",
      "/agenda",
      "/agenda/settings",
      "/agenda/insights",
      "/agenda/visits",
      "/agenda/account-review",
      "/settings",
      "/settings/",
    ]) {
      assert.equal(isDoctorProductPath(path), true, path);
    }
  });

  it("leaves out the appointment review page and look-alike paths", () => {
    for (const path of [
      "/",
      "/dashboard/appointments/abc",
      "/dashboardx",
      "/agendas",
      "/settingsx",
      "/login",
    ]) {
      assert.equal(isDoctorProductPath(path), false, path);
    }
  });
});

describe("selectedDoctorNavTab", () => {
  it("follows the current page when nothing is loading", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", null), "dashboard");
    assert.equal(selectedDoctorNavTab("/settings", null), "settings");
  });

  it("jumps to the tab being opened before the page arrives", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", "/settings"), "settings");
    // A hidden page is no tab to jump to.
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda/insights"), "dashboard");
    assert.equal(selectedDoctorNavTab("/agenda", "/dashboard"), "dashboard");
  });

  it("ignores pending links that are not tabs", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda?manual=1"), "dashboard");
    assert.equal(selectedDoctorNavTab("/dashboard", "/settings?section=promote"), "dashboard");
    assert.equal(selectedDoctorNavTab("/for-professionals", "/some-public-page"), null);
  });
});

describe("pendingBadgeLabel", () => {
  it("hides the badge when nothing is waiting", () => {
    assert.equal(pendingBadgeLabel(0), null);
    assert.equal(pendingBadgeLabel(-1), null);
    assert.equal(pendingBadgeLabel(Number.NaN), null);
    assert.equal(pendingBadgeLabel(null), null);
  });

  it("shows the count up to nine, then 9+", () => {
    assert.equal(pendingBadgeLabel(1), "1");
    assert.equal(pendingBadgeLabel(9), "9");
    assert.equal(pendingBadgeLabel(10), "9+");
    assert.equal(pendingBadgeLabel(42), "9+");
  });
});

// An applicant's /dashboard bounces back to their status page, so the logo spun forever
// (user, 2026-10-08): their logo goes straight to the status page.
describe("logoHomeHref", () => {
  it("professionals go to the dashboard", () => {
    assert.equal(logoHomeHref({ applicant: false }), "/dashboard");
  });

  it("applicants (no approved profile yet) go to their application status", () => {
    assert.equal(logoHomeHref({ applicant: true }), "/agenda/status");
  });
});

// On public pages (finder, profile) a desktop professional has no header tabs: the account menu
// lists the sections instead; never twice, never for applicants (user, 2026-10-08).
describe("showSectionsInAccountMenu", () => {
  it("shows them on pages without the header tabs", () => {
    assert.equal(showSectionsInAccountMenu({ applicant: false, headerHasTabs: false }), true);
  });

  it("not where the header already has them", () => {
    assert.equal(showSectionsInAccountMenu({ applicant: false, headerHasTabs: true }), false);
  });

  it("never for applicants", () => {
    assert.equal(showSectionsInAccountMenu({ applicant: true, headerHasTabs: false }), false);
  });
});

// The account menu (photo, top right; "More" on a phone) is for account things
// (user, 2026-10-12): no "Promote" shortcut, and manual booking only outside her
// private space, where nothing else leads to it.
describe("accountMenuItems", () => {
  const base = { applicant: false, insidePrivateSpace: true, hasPublicProfile: true, onOwnProfile: false };

  it("inside her private space: her account, her profile, support, log out", () => {
    assert.deepEqual(accountMenuItems(base), ["account", "plan", "public-profile", "support", "logout"]);
  });

  it("on the finder and public pages: manual booking comes first", () => {
    assert.deepEqual(accountMenuItems({ ...base, insidePrivateSpace: false }), [
      "manual-booking",
      "account",
      "plan",
      "public-profile",
      "support",
      "logout",
    ]);
  });

  it("on her own public profile: no link to the page she is on", () => {
    assert.deepEqual(accountMenuItems({ ...base, insidePrivateSpace: false, onOwnProfile: true }), [
      "manual-booking",
      "account",
      "plan",
      "support",
      "logout",
    ]);
  });

  it("without a public profile: no link to it", () => {
    assert.deepEqual(accountMenuItems({ ...base, hasPublicProfile: false }), ["account", "plan", "support", "logout"]);
  });

  it("an applicant gets support and log out only", () => {
    assert.deepEqual(accountMenuItems({ ...base, applicant: true }), ["support", "logout"]);
    assert.deepEqual(accountMenuItems({ ...base, applicant: true, insidePrivateSpace: false }), ["support", "logout"]);
  });
});
