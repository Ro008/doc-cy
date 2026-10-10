import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_SERVICE_OTHER,
  bookingServiceOptions,
  bookingServiceRequest,
} from "../../lib/booking-service-choice";

const services = [
  { id: "6a1f8a52-2b8f-4c1e-9d55-0f3c2a7b9e10", name: "Heart check-up", price: "80" },
  { id: "0b7c4d2e-1a3f-4b5c-8d9e-7f6a5b4c3d2e", name: "ECG", price: null },
];

describe("booking service picker", () => {
  it("lists her services by name only, never the price, then Other", () => {
    assert.deepEqual(bookingServiceOptions(services, "Other"), [
      { value: services[0].id, label: "Heart check-up" },
      { value: services[1].id, label: "ECG" },
      { value: BOOKING_SERVICE_OTHER, label: "Other" },
    ]);
  });

  it("offers no picker when she lists no services", () => {
    assert.deepEqual(bookingServiceOptions([], "Other"), []);
  });

  it("sends the chosen service and the patient's optional words (user, 2026-10-09)", () => {
    assert.deepEqual(
      bookingServiceRequest({ choice: services[0].id, services, visitReason: " A spot on the side of my lip " }),
      { professionalServiceId: services[0].id, reason: "A spot on the side of my lip" },
    );
  });

  it("a chosen service with no words still sends a reason: the service name (the database needs one)", () => {
    assert.deepEqual(bookingServiceRequest({ choice: services[0].id, services, visitReason: "  " }), {
      professionalServiceId: services[0].id,
      reason: "Heart check-up",
    });
  });

  it("Other sends the patient's own words and no service", () => {
    assert.deepEqual(bookingServiceRequest({ choice: BOOKING_SERVICE_OTHER, services, visitReason: "  Back pain " }), {
      reason: "Back pain",
    });
  });

  it("no services: the reason as today", () => {
    assert.deepEqual(bookingServiceRequest({ choice: null, services: [], visitReason: "Check-up" }), {
      reason: "Check-up",
    });
  });

  it("an id that is no longer hers falls back to the typed reason, without a service", () => {
    assert.deepEqual(bookingServiceRequest({ choice: "gone", services, visitReason: "Check-up" }), {
      reason: "Check-up",
    });
  });
});
