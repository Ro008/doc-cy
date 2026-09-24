import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agendaRefreshOutcome } from "../../lib/agenda-refresh";

describe("agendaRefreshOutcome", () => {
  it("replaces the list with the rows the server returned", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    assert.deepEqual(agendaRefreshOutcome({ hasSession: true, error: null, data: rows }), {
      kind: "replace",
      rows,
    });
  });

  it("replaces with an empty list when a signed-in professional really has no appointments", () => {
    assert.deepEqual(agendaRefreshOutcome({ hasSession: true, error: null, data: [] }), {
      kind: "replace",
      rows: [],
    });
  });

  it("keeps the list when the browser has no session, because RLS then answers an empty 200", () => {
    assert.deepEqual(agendaRefreshOutcome({ hasSession: false, error: null, data: [] }), {
      kind: "keep",
      reason: "signed_out",
    });
  });

  it("reports signed out even if rows came back, since they can't be the professional's", () => {
    assert.deepEqual(
      agendaRefreshOutcome({ hasSession: false, error: null, data: [{ id: "a" }] }),
      { kind: "keep", reason: "signed_out" },
    );
  });

  it("keeps the list when the read fails", () => {
    assert.deepEqual(
      agendaRefreshOutcome({ hasSession: true, error: { message: "JWT expired" }, data: null }),
      { kind: "keep", reason: "error" },
    );
  });

  it("keeps the list when the read returns no data at all", () => {
    assert.deepEqual(agendaRefreshOutcome({ hasSession: true, error: null, data: null }), {
      kind: "keep",
      reason: "error",
    });
  });
});
