import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINDER_RECENTLY_VIEWED_MAX,
  FINDER_RECENTLY_VIEWED_STORAGE_KEY,
  readRecentlyViewed,
  recordRecentlyViewed,
  trimRecentlyViewedPerKind,
} from "@/lib/finder-recently-viewed";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe("finder recently viewed", () => {
  it("records, dedupes by href, and keeps newest first", () => {
    const storage = memoryStorage();
    recordRecentlyViewed(
      {
        kind: "professional",
        href: "/finder/professional/anna",
        name: "Anna",
        subtitle: "Dentistry",
        location: "Paphos",
        photoUrl: null,
      },
      storage,
      100,
    );
    recordRecentlyViewed(
      {
        kind: "clinic",
        href: "/clinics/sunrise",
        name: "Sunrise",
        subtitle: "Clinic",
        location: "Limassol",
        photoUrl: "/x.png",
      },
      storage,
      200,
    );
    recordRecentlyViewed(
      {
        kind: "professional",
        href: "/finder/professional/anna",
        name: "Anna Updated",
        subtitle: "Dentistry",
        location: "Paphos",
        photoUrl: null,
      },
      storage,
      300,
    );

    const rows = readRecentlyViewed(storage);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.href, "/finder/professional/anna");
    assert.equal(rows[0]?.name, "Anna Updated");
    assert.equal(rows[0]?.viewedAt, 300);
    assert.equal(rows[1]?.href, "/clinics/sunrise");
  });

  it("caps length per kind, not across kinds", () => {
    const storage = memoryStorage();
    for (let i = 0; i < FINDER_RECENTLY_VIEWED_MAX + 3; i += 1) {
      recordRecentlyViewed(
        {
          kind: "professional",
          href: `/p/${i}`,
          name: `Pro ${i}`,
          subtitle: "GP",
          location: "Nicosia",
          photoUrl: null,
        },
        storage,
        i,
      );
      recordRecentlyViewed(
        {
          kind: "clinic",
          href: `/c/${i}`,
          name: `Clinic ${i}`,
          subtitle: "Clinic",
          location: "Limassol",
          photoUrl: null,
        },
        storage,
        i + 100,
      );
    }

    const rows = readRecentlyViewed(storage);
    const pros = rows.filter((row) => row.kind === "professional");
    const clinics = rows.filter((row) => row.kind === "clinic");
    assert.equal(pros.length, FINDER_RECENTLY_VIEWED_MAX);
    assert.equal(clinics.length, FINDER_RECENTLY_VIEWED_MAX);
    assert.equal(rows.length, FINDER_RECENTLY_VIEWED_MAX * 2);
    assert.equal(pros[0]?.href, `/p/${FINDER_RECENTLY_VIEWED_MAX + 2}`);
    assert.equal(clinics[0]?.href, `/c/${FINDER_RECENTLY_VIEWED_MAX + 2}`);
  });

  it("trimRecentlyViewedPerKind keeps newest of each kind", () => {
    const trimmed = trimRecentlyViewedPerKind(
      [
        {
          kind: "clinic",
          href: "/c/new",
          name: "New",
          subtitle: "Clinic",
          location: "Nicosia",
          photoUrl: null,
          viewedAt: 3,
        },
        {
          kind: "professional",
          href: "/p/a",
          name: "A",
          subtitle: "GP",
          location: "Nicosia",
          photoUrl: null,
          viewedAt: 2,
        },
        {
          kind: "clinic",
          href: "/c/old",
          name: "Old",
          subtitle: "Clinic",
          location: "Nicosia",
          photoUrl: null,
          viewedAt: 1,
        },
      ],
      1,
    );
    assert.deepEqual(
      trimmed.map((row) => row.href),
      ["/c/new", "/p/a"],
    );
  });

  it("ignores corrupt storage", () => {
    const storage = memoryStorage();
    storage.setItem(FINDER_RECENTLY_VIEWED_STORAGE_KEY, "{not-json");
    assert.deepEqual(readRecentlyViewed(storage), []);
  });
});
