import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ManualClinicRef } from "@/lib/manual-directory-clinics";
import {
  clinicForRenderedLocation,
  sameClinicAddress,
} from "@/lib/public/finder-card-clinic-match";

const clinic = (over: Partial<ManualClinicRef> = {}): ManualClinicRef => ({
  id: "clinic-1",
  name: "Maria Chrysostomou",
  slug: "maria-chrysostomou-a1439-paphos",
  isPrimary: true,
  address: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
  addressMapsLink: null,
  district: "Paphos",
  hasPhone: true,
  ...over,
});

describe("sameClinicAddress", () => {
  it("matches the same address written with different case, spacing and punctuation", () => {
    assert.equal(
      sameClinicAddress(
        "Anthipolochagou Georgiou Savva 26, Geroskipou, Pafos 8201, Cyprus",
        "anthipolochagou  georgiou savva 26 — geroskipou, pafos 8201, cyprus",
      ),
      true,
    );
  });

  it("treats a trailing country as noise, since only one side carries it", () => {
    assert.equal(
      sameClinicAddress(
        "Zinonos 5, Geroskipou, 8200, Paphos, Cyprus",
        "Zinonos 5, Geroskipou, 8200, Paphos",
      ),
      true,
    );
  });

  it("does not match two different addresses", () => {
    assert.equal(
      sameClinicAddress(
        "B6 39, Geroskipou, Pafos 8035, Cyprus",
        "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
      ),
      false,
    );
  });

  it("does not match when one side is blank", () => {
    assert.equal(sameClinicAddress("", "Zinonos 5, Geroskipou, 8200, Paphos"), false);
    assert.equal(sameClinicAddress("Zinonos 5, Geroskipou, 8200, Paphos", null), false);
  });
});

describe("clinicForRenderedLocation", () => {
  const pegeia = clinic();
  const geroskipou = clinic({
    id: "clinic-2",
    name: "Solomonidi Physiotherapy",
    slug: "solomonidi-physiotherapy-paphos",
    isPrimary: false,
    address: "B6 39, Geroskipou, Pafos 8035, Cyprus",
  });

  it("uses the join-row match, which is authoritative", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-1",
      locationAddress: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
      byLocationId: new Map([["loc-1", pegeia]]),
      candidates: [],
    });
    assert.equal(got, pegeia);
  });

  it("prefers the join-row match even when the candidates disagree", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-1",
      locationAddress: "B6 39, Geroskipou, Pafos 8035, Cyprus",
      byLocationId: new Map([["loc-1", pegeia]]),
      candidates: [geroskipou],
    });
    assert.equal(got, pegeia);
  });

  it("names the linked clinic that sits at the address being rendered", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-unmatched",
      locationAddress: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
      byLocationId: new Map(),
      candidates: [pegeia],
    });
    assert.equal(got, pegeia);
  });

  /**
   * A professional practising in two places: each rendered address must pick up its
   * own clinic, not whichever one happens to be first.
   */
  it("picks the right clinic per address when there are several", () => {
    const both = [pegeia, geroskipou];
    assert.equal(
      clinicForRenderedLocation({
        locationId: "unmatched-a",
        locationAddress: "B6 39, Geroskipou, Pafos 8035, Cyprus",
        byLocationId: new Map(),
        candidates: both,
      }),
      geroskipou,
    );
    assert.equal(
      clinicForRenderedLocation({
        locationId: "unmatched-b",
        locationAddress: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
        byLocationId: new Map(),
        candidates: both,
      }),
      pegeia,
    );
  });

  it("uses the only linked clinic when the location has no address to contradict it", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-unmatched",
      locationAddress: null,
      byLocationId: new Map(),
      candidates: [pegeia],
    });
    assert.equal(got, pegeia);
  });

  it("stays silent with no address and several clinics, since it cannot choose", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-unmatched",
      locationAddress: "",
      byLocationId: new Map(),
      candidates: [pegeia, geroskipou],
    });
    assert.equal(got, null);
  });

  /**
   * The case this module exists for. A professional registers their own new address,
   * then Verify absorbs the finder listing they claimed, which brings the old clinic
   * across as their only `professional_clinics` row. Naming that clinic above the new
   * address tells patients the wrong practice — so no name is shown at all.
   */
  it("shows no clinic when the only linked clinic sits at a different address", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-unmatched",
      locationAddress: "B6 39, Geroskipou, Pafos 8035, Cyprus",
      byLocationId: new Map(),
      candidates: [pegeia],
    });
    assert.equal(got, null);
  });

  it("applies the same rule to cards with no location row at all", () => {
    assert.equal(
      clinicForRenderedLocation({
        locationId: null,
        locationAddress: "Avenue Michalaki Kyprianou 24, Pegeia, 8560, Paphos",
        byLocationId: new Map([["loc-1", pegeia]]),
        candidates: [pegeia],
      }),
      pegeia,
    );
    assert.equal(
      clinicForRenderedLocation({
        locationId: null,
        locationAddress: "B6 39, Geroskipou, Pafos 8035, Cyprus",
        byLocationId: new Map([["loc-1", pegeia]]),
        candidates: [pegeia],
      }),
      null,
    );
  });

  it("shows no clinic when there is neither a match nor a candidate", () => {
    const got = clinicForRenderedLocation({
      locationId: "loc-unmatched",
      locationAddress: "B6 39, Geroskipou, Pafos 8035, Cyprus",
      byLocationId: new Map(),
      candidates: [],
    });
    assert.equal(got, null);
  });
});
