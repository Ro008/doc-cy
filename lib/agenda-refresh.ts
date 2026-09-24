/**
 * What the agenda does with the result of re-reading its appointments.
 *
 * Without a session the browser's read runs as `anon`, and RLS answers
 * `200 []` rather than an error, so an empty list can't be trusted on its own:
 * replacing the agenda with it would make a professional think their
 * appointments are gone. The agenda keeps what it has instead and says why.
 */
export type AgendaRefreshOutcome<Row> =
  | { kind: "replace"; rows: Row[] }
  | { kind: "keep"; reason: "signed_out" | "error" };

export function agendaRefreshOutcome<Row>(input: {
  hasSession: boolean;
  error: unknown;
  data: Row[] | null;
}): AgendaRefreshOutcome<Row> {
  if (!input.hasSession) return { kind: "keep", reason: "signed_out" };
  if (input.error || !input.data) return { kind: "keep", reason: "error" };
  return { kind: "replace", rows: input.data };
}
