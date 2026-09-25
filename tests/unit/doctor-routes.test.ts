import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCTOR_HOME_PATH,
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
        ["settings", "Settings", "/agenda/settings"],
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
    assert.equal(activeDoctorNavTab("/agenda/settings"), "settings");
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
      "/login",
    ]) {
      assert.equal(isDoctorProductPath(path), false, path);
    }
  });
});

describe("selectedDoctorNavTab", () => {
  it("follows the current page when nothing is loading", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", null), "dashboard");
    assert.equal(selectedDoctorNavTab("/agenda/settings", null), "settings");
  });

  it("jumps to the tab being opened before the page arrives", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda/insights"), "insights");
    assert.equal(selectedDoctorNavTab("/agenda", "/dashboard"), "dashboard");
  });

  it("ignores pending links that are not tabs", () => {
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda?manual=1"), "dashboard");
    assert.equal(selectedDoctorNavTab("/dashboard", "/agenda/settings#promote-practice"), "dashboard");
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
