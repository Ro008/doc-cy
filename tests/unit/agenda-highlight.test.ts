import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agendaHighlightHref, parseAgendaHighlight } from "../../lib/agenda-highlight";

describe("agendaHighlightHref", () => {
  it("opens the agenda on the visit's day and names the visit to highlight", () => {
    assert.equal(
      agendaHighlightHref("2026-09-25", "25eafb1a-a608-4c04-9774-94df26211adb"),
      "/agenda?date=2026-09-25&highlight=25eafb1a-a608-4c04-9774-94df26211adb",
    );
  });
});

describe("parseAgendaHighlight", () => {
  it("accepts an appointment id", () => {
    assert.equal(parseAgendaHighlight("25eafb1a-a608-4c04-9774-94df26211adb"), "25eafb1a-a608-4c04-9774-94df26211adb");
    assert.equal(parseAgendaHighlight(" abc-123 "), "abc-123");
  });

  it("ignores anything that is not a plain id", () => {
    for (const raw of [undefined, null, "", "   ", "a b", "<script>", "x".repeat(65), ["abc"]]) {
      assert.equal(parseAgendaHighlight(raw as never), null, String(raw));
    }
  });
});
