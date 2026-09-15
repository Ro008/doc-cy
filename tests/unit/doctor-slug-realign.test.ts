import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDoctorSlugCandidates,
  realignDoctorSlugIfNameChanged,
  slugifyDoctorPublicName,
} from "../../lib/doctor-slug";

describe("doctor slug realign", () => {
  it("slugifyDoctorPublicName normalizes accents", () => {
    assert.equal(slugifyDoctorPublicName("Dr María López"), "dr-maria-lopez");
  });

  it("buildDoctorSlugCandidates includes district suffix", () => {
    const candidates = buildDoctorSlugCandidates({
      name: "Maria Papadopoulos",
      district: "Nicosia",
      authUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    assert.ok(candidates.includes("maria-papadopoulos-nicosia"));
  });

  it("realignDoctorSlugIfNameChanged returns null when slug already matches", async () => {
    const updates: { slug?: string }[] = [];
    const supabase = {
      from() {
        return {
          select() {
            return {
              async in() {
                return { data: [{ slug: "maria-papadopoulos-nicosia" }], error: null };
              },
            };
          },
          update(payload: { slug: string }) {
            updates.push(payload);
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const result = await realignDoctorSlugIfNameChanged(supabase as never, {
      doctorId: "doc-1",
      name: "Maria Papadopoulos",
      district: "Nicosia",
      authUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      currentSlug: "maria-papadopoulos-nicosia",
    });

    assert.equal(result, null);
    assert.equal(updates.length, 0);
  });

  it("realignDoctorSlugIfNameChanged updates slug when name changed", async () => {
    const updates: { slug?: string }[] = [];
    const supabase = {
      from() {
        return {
          select() {
            return {
              async in() {
                return { data: [], error: null };
              },
            };
          },
          update(payload: { slug: string }) {
            updates.push(payload);
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const result = await realignDoctorSlugIfNameChanged(supabase as never, {
      doctorId: "doc-1",
      name: "Anna Georgiou",
      district: "Limassol",
      authUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      currentSlug: "old-listing-slug",
    });

    assert.equal(result, "anna-georgiou");
    assert.equal(updates[0]?.slug, "anna-georgiou");
  });
});
