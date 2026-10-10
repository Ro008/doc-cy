import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SERVICES,
  formatServicePrice,
  parseSavedServices,
  parseServicePrice,
  serviceFromBody,
  serviceNameTaken,
  storedServicePrice,
  validateService,
} from "../../lib/settings-services";

/**
 * Settings → Services & prices (user, 2026-10-10): a price list. Each service has a name
 * and an optional price in euros, exact or "from"; at most 20, no name twice.
 */

describe("parseServicePrice", () => {
  it("reads an exact price and a 'from' price", () => {
    assert.deepEqual(parseServicePrice("120"), { amount: "120", from: false });
    assert.deepEqual(parseServicePrice("From 80"), { amount: "80", from: true });
    assert.deepEqual(parseServicePrice(" from 49.50 "), { amount: "49.50", from: true });
  });

  it("gives null for no price or text it does not know", () => {
    for (const price of [null, undefined, "", "  ", "Ask at the clinic", "80-120", 90]) {
      assert.equal(parseServicePrice(price), null);
    }
  });
});

describe("formatServicePrice", () => {
  it("shows euros, with From when she ticked it", () => {
    assert.equal(formatServicePrice("120"), "€120");
    assert.equal(formatServicePrice("From 80"), "From €80");
    assert.equal(formatServicePrice("49.50"), "€49.50");
  });

  it("shows older free text as it is, and nothing for no price", () => {
    assert.equal(formatServicePrice("Ask at the clinic"), "Ask at the clinic");
    assert.equal(formatServicePrice(null), null);
    assert.equal(formatServicePrice("  "), null);
  });
});

describe("storedServicePrice", () => {
  it("is the text kept in the database", () => {
    assert.equal(storedServicePrice({ amount: "120", from: false }), "120");
    assert.equal(storedServicePrice({ amount: "80", from: true }), "From 80");
    assert.equal(storedServicePrice(null), null);
  });
});

describe("validateService", () => {
  it("accepts a name alone, trimmed and single-spaced", () => {
    assert.deepEqual(validateService({ name: "  Facial   laser ", price: "", priceFrom: false }), {
      ok: true,
      service: { name: "Facial laser", price: null },
    });
  });

  it("accepts a price in euros, with a comma or a point, exact or from", () => {
    assert.deepEqual(validateService({ name: "Consultation", price: " 60 ", priceFrom: false }), {
      ok: true,
      service: { name: "Consultation", price: "60" },
    });
    assert.deepEqual(validateService({ name: "Laser", price: "49,5", priceFrom: true }), {
      ok: true,
      service: { name: "Laser", price: "From 49.50" },
    });
    assert.deepEqual(validateService({ name: "Laser", price: "080.00", priceFrom: false }), {
      ok: true,
      service: { name: "Laser", price: "80" },
    });
    assert.deepEqual(validateService({ name: "Free check", price: "0", priceFrom: false }), {
      ok: true,
      service: { name: "Free check", price: "0" },
    });
  });

  it("asks for a name of at most 80 characters", () => {
    const empty = validateService({ name: "   ", price: "10", priceFrom: false });
    assert.equal(empty.ok, false);
    assert.equal(empty.ok === false && empty.errors.name, "Enter the name of the service.");
    const long = validateService({ name: "x".repeat(81), price: "", priceFrom: false });
    assert.equal(long.ok === false && long.errors.name, "Use 80 characters or fewer.");
    assert.equal(validateService({ name: "x".repeat(80), price: "", priceFrom: false }).ok, true);
  });

  it("refuses a price that is not an amount in euros", () => {
    for (const price of ["abc", "€60", "60 EUR", "-5", "1.234", "100000", "12.345", "From 80"]) {
      const check = validateService({ name: "Laser", price, priceFrom: false });
      assert.equal(check.ok, false, price);
      assert.equal(check.ok === false && check.errors.price, "Enter an amount in euros, for example 60 or 49.50.");
    }
  });

  it("refuses 'from' without an amount", () => {
    const check = validateService({ name: "Laser", price: "", priceFrom: true });
    assert.equal(check.ok === false && check.errors.price, "Enter the lowest price, or untick From.");
  });
});

describe("serviceFromBody", () => {
  it("reads what the page sends", () => {
    assert.deepEqual(serviceFromBody({ name: "Laser", price: 80, priceFrom: true }), {
      ok: true,
      service: { name: "Laser", price: "From 80" },
    });
    assert.deepEqual(serviceFromBody({ name: "Laser", price: null }), {
      ok: true,
      service: { name: "Laser", price: null },
    });
  });

  it("refuses anything else", () => {
    for (const body of [null, "x", {}, { name: 5 }, { name: "Laser", price: {} }]) {
      assert.equal(serviceFromBody(body).ok, false);
    }
  });
});

describe("serviceNameTaken", () => {
  const list = [
    { id: "a", name: "Facial laser", price: null },
    { id: "b", name: "Consultation", price: "60" },
  ];

  it("finds the same name whatever the capitals and spaces", () => {
    assert.equal(serviceNameTaken(list, " facial  LASER "), true);
    assert.equal(serviceNameTaken(list, "Botox"), false);
  });

  it("does not count the service being edited", () => {
    assert.equal(serviceNameTaken(list, "facial laser", "a"), false);
    assert.equal(serviceNameTaken(list, "consultation", "a"), true);
  });
});

describe("parseSavedServices", () => {
  it("keeps the usable rows", () => {
    assert.deepEqual(
      parseSavedServices([
        { id: "a", name: " Laser ", price: "From 80", created_at: "x" },
        { id: "b", name: "Consultation", price: "" },
        { id: "", name: "No id" },
        { id: "c", name: "  " },
        null,
      ]),
      [
        { id: "a", name: "Laser", price: "From 80" },
        { id: "b", name: "Consultation", price: null },
      ],
    );
    assert.deepEqual(parseSavedServices("nope"), []);
  });
});

describe("MAX_SERVICES", () => {
  it("is 20", () => assert.equal(MAX_SERVICES, 20));
});
