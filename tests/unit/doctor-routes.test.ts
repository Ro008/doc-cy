import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCTOR_HOME_PATH,
  logoHomeHref,
  showSectionsInAccountMenu,
  DOCTOR_NAV_TABS,
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
  it("lists dashboard, agenda, settings and insights in that order", () => {
    assert.deepEqual(
      DOCTOR_NAV_TABS.map((tab) => [tab.id, tab.label, tab.href]),
      [
        ["dashboard", "Dashboard", "/dashboard"],
        ["agenda", "Agenda", "/agenda"],
        // Settings is its own page, not under the agenda (settings redesign, 2026-09-30).
        ["settings", "Settings", "/settings"],
        ["insights", "Insights", "/agenda/insights"],
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
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda/insights"), "insights");
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
