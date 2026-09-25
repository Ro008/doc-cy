import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCTOR_HOME_PATH,
  DOCTOR_NAV_TABS,
  activeDoctorNavTab,
  isDoctorProductPath,
  postLoginDestination,
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
