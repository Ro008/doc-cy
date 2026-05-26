import { expect, test } from "@playwright/test";
import {
  isRescheduleProposalLive,
  isVisitSlotEnded,
} from "@/lib/appointments";

test.describe("appointment visit timing helpers", () => {
  test("isVisitSlotEnded uses start plus duration", () => {
    const now = new Date("2026-05-15T12:00:00.000Z").getTime();
    const start = "2026-05-15T11:00:00.000Z";
    expect(isVisitSlotEnded(start, 30, now)).toBe(true);
    expect(isVisitSlotEnded(start, 120, now)).toBe(false);
  });

  test("isRescheduleProposalLive requires NEEDS_RESCHEDULE and future expiry", () => {
    const now = new Date("2026-05-15T12:00:00.000Z").getTime();
    expect(
      isRescheduleProposalLive(
        "NEEDS_RESCHEDULE",
        "2026-05-16T12:00:00.000Z",
        now,
      ),
    ).toBe(true);
    expect(
      isRescheduleProposalLive(
        "CONFIRMED",
        "2026-05-16T12:00:00.000Z",
        now,
      ),
    ).toBe(false);
    expect(
      isRescheduleProposalLive(
        "NEEDS_RESCHEDULE",
        "2026-05-14T12:00:00.000Z",
        now,
      ),
    ).toBe(false);
  });
});
