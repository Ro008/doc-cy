import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { bookingServiceRequest } from "../../lib/booking-service-choice";
import { firstManualBookingError, type ManualBookingValues } from "../../lib/manual-booking-validation";

/**
 * "Add manual booking" with an optional service (user, 2026-10-13): the professional can pick one
 * of her services when she types in a phone or walk-in visit. Never required, so a quick call
 * costs nothing more; picking one even saves her the reason (the service name stands in, as on
 * the public form). The server already takes `professionalServiceId` (POST /api/appointments/manual).
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

const NOW = new Date("2026-10-13T09:00:00Z");
const base: ManualBookingValues = {
  patientName: "Maria Georgiou",
  patientPhone: "+357 99 123456",
  patientEmail: "",
  patientBirthdate: "",
  reason: "",
};

describe("manual booking validation with a service", () => {
  it("still wants a reason when no service was picked, as before", () => {
    assert.deepEqual(firstManualBookingError(base, NOW), {
      field: "reason",
      message: "Enter a short reason for the visit.",
    });
    assert.deepEqual(firstManualBookingError({ ...base, hasService: false }, NOW)?.field, "reason");
  });

  it("does not want one when a service was picked: the service says why", () => {
    assert.equal(firstManualBookingError({ ...base, hasService: true }, NOW), null);
  });

  it("still checks everything else with a service picked", () => {
    assert.equal(firstManualBookingError({ ...base, hasService: true, patientName: "  " }, NOW)?.field, "patientName");
  });
});

describe("what is sent for a manual booking", () => {
  const services = [
    { id: "s-laser", name: "Facial laser" },
    { id: "s-clean", name: "Cleaning" },
  ];

  it("sends the service and, with no words typed, its name as the reason", () => {
    assert.deepEqual(bookingServiceRequest({ choice: "s-laser", services, visitReason: "" }), {
      professionalServiceId: "s-laser",
      reason: "Facial laser",
    });
  });

  it("keeps her own words when she typed some", () => {
    assert.deepEqual(bookingServiceRequest({ choice: "s-clean", services, visitReason: "Sensitive teeth" }), {
      professionalServiceId: "s-clean",
      reason: "Sensitive teeth",
    });
  });

  it("sends no service when none was picked", () => {
    assert.deepEqual(bookingServiceRequest({ choice: null, services, visitReason: "Called in" }), {
      reason: "Called in",
    });
  });
});

describe("the manual booking window", () => {
  const flow = read("components/agenda/ManualBookingFlow.tsx");

  it("offers her services as an optional choice, only when she has some", () => {
    assert.match(flow, /services\?: BookingServiceItem\[\]/);
    assert.match(flow, /services = \[\]/);
    assert.match(flow, /services\.length > 0/);
    assert.match(flow, /Service <span[^>]*>\(optional\)/);
    assert.match(flow, /id="manualService"/);
    // "No service" is the default, so doing nothing costs nothing.
    assert.match(flow, /<option value="">No service<\/option>/);
  });

  it("sits above the reason, and a picked service makes the reason optional", () => {
    assert.ok(flow.indexOf('id="manualService"') < flow.indexOf('id="manualReason"'));
    assert.match(flow, /hasService/);
    assert.match(flow, /bookingServiceRequest\(/);
    assert.match(flow, /professionalServiceId/);
  });

  it("forgets the choice with the rest of the form", () => {
    assert.match(flow, /setServiceChoice\(""\)/);
  });

  it("is given the professional's services by the agenda and the dashboard", () => {
    for (const [file, prop] of [
      ["components/agenda/AgendaRealtime.tsx", "services={services}"],
      ["components/dashboard/DoctorDashboard.tsx", "services={services}"],
    ] as const) {
      assert.match(read(file), new RegExp(prop.replace(/[{}]/g, "\\$&")), file);
    }
    for (const file of ["app/agenda/(calendar)/page.tsx", "app/dashboard/(home)/page.tsx"]) {
      const page = read(file);
      assert.match(page, /loadOwnServices\(/, file);
      assert.match(page, /services=\{/, file);
    }
  });

  it("reads the services as a plain list of id and name, read only", () => {
    const loader = read("lib/load-own-services.ts");
    assert.match(loader, /from\("professional_services"\)/);
    assert.match(loader, /select\("id, name"\)/);
    assert.match(loader, /\.eq\("professional_id"/);
    assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});

describe("Settings › Services: the 'What are services?' block", () => {
  const form = read("components/dashboard/SettingsForm.tsx");
  const block = form.slice(
    form.indexOf('data-testid="settings-services-why"'),
    form.indexOf("<ServicesCard"),
  );
  const points = form.slice(
    form.indexOf("const SERVICES_WHY_POINTS"),
    form.indexOf("] as const;", form.indexOf("const SERVICES_WHY_POINTS")),
  );

  it("has four points, each with its own icon", () => {
    assert.equal((points.match(/Icon: /g) ?? []).length, 4);
    for (const icon of ["Stethoscope", "Euro", "PhoneOff", "CalendarCheck"]) {
      assert.match(points, new RegExp(`Icon: ${icon},`), icon);
    }
    assert.match(points, /You know why they’re coming/);
    assert.match(points, /patients can pick one of your services, and you see it with the visit/);
  });

  it("draws each as a small card with its icon on a tinted tile, the icon as decoration", () => {
    assert.match(block, /SERVICES_WHY_POINTS\.map\(/);
    assert.match(block, /data-testid="services-why-icon"/);
    assert.match(block, /aria-hidden="true"/);
    assert.match(block, /bg-clinical-400\/15 text-clinical-300/);
    assert.match(block, /rounded-2xl border/);
  });
});
