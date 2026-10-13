"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  applyRealtimeRequestChange,
  freshlyShownIds,
  newRequestsCount,
  NEW_REQUESTS_HIGHLIGHT_MS,
  NEW_REQUESTS_POLL_MS,
  serverExtraCount,
} from "@/lib/dashboard-new-requests";
import { DASHBOARD_NEEDS_ANSWER_ID } from "@/lib/doctor-dashboard";

/** If the refresh never lands, give the bar back instead of hiding it for good. */
const SHOW_GIVE_UP_MS = 15_000;

type Showing = { before: ReadonlySet<string>; serverIdsAtShow: readonly string[] };

/**
 * "N new requests · Show" (lib/dashboard-new-requests.ts): Realtime on her appointments,
 * plus the pending count every minute and on focus. Show refreshes the page and marks
 * the rows that came in.
 */
export function useNewRequests({
  doctorId,
  shownIds,
  serverPendingIds,
}: {
  doctorId: string;
  /** Pending requests on screen, not counting rows sliding out. */
  shownIds: ReadonlySet<string>;
  /** Pending ids of the latest server render; a new array means a refresh landed. */
  serverPendingIds: readonly string[];
}) {
  const router = useRouter();
  const [supabase] = React.useState(() => createClientComponentClient());
  const [arrivedIds, setArrivedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [serverExtra, setServerExtra] = React.useState(0);
  const [live, setLive] = React.useState(false);
  const [showing, setShowing] = React.useState<Showing | null>(null);
  const [highlightedIds, setHighlightedIds] = React.useState<ReadonlySet<string>>(() => new Set());

  const shownRef = React.useRef(shownIds);
  const serverIdsRef = React.useRef(serverPendingIds);
  React.useEffect(() => {
    shownRef.current = shownIds;
    serverIdsRef.current = serverPendingIds;
  });

  const checkCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/doctor-dashboard/pending-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as { count?: unknown } | null;
      if (typeof data?.count !== "number") return;
      setServerExtra(serverExtraCount(data.count, shownRef.current.size));
    } catch {
      // Realtime is the main signal; a failed check just waits for the next one.
    }
  }, []);

  React.useEffect(() => {
    void checkCount();
    const onFocus = () => void checkCount();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => void checkCount(), NEW_REQUESTS_POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, [checkCount]);

  React.useEffect(() => {
    if (!doctorId) return;
    const onChange = (payload: { new: Record<string, unknown> | null }) => {
      setArrivedIds((prev) => applyRealtimeRequestChange(prev, payload.new, Date.now()));
      // Keeps the server signal current too, e.g. when a request is handled in another tab.
      void checkCount();
    };
    const filter = `professional_id=eq.${doctorId}`;
    const channel = supabase
      .channel(`dashboard-new-requests-${doctorId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments", filter }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "appointments", filter }, onChange)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [doctorId, supabase, checkCount]);

  const show = React.useCallback(() => {
    const snapshot: Showing = { before: new Set(shownRef.current), serverIdsAtShow: serverIdsRef.current };
    setShowing(snapshot);
    setArrivedIds(new Set());
    setServerExtra(0);
    router.refresh();
    window.setTimeout(() => setShowing((current) => (current === snapshot ? null : current)), SHOW_GIVE_UP_MS);
  }, [router]);

  // The refresh landed: mark what came in and bring the list into view.
  React.useEffect(() => {
    if (!showing || serverPendingIds === showing.serverIdsAtShow) return;
    setShowing(null);
    // A check that answered mid-refresh compared against the old list; ask again.
    void checkCount();
    const fresh = freshlyShownIds(showing.before, serverPendingIds);
    if (fresh.length === 0) return;
    setHighlightedIds(new Set(fresh));
    const section = document.getElementById(DASHBOARD_NEEDS_ANSWER_ID);
    const top = section?.getBoundingClientRect().top;
    if (section && top !== undefined && (top < 0 || top > window.innerHeight * 0.6)) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [serverPendingIds, showing, checkCount]);

  React.useEffect(() => {
    if (highlightedIds.size === 0) return;
    const id = window.setTimeout(() => setHighlightedIds(new Set()), NEW_REQUESTS_HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [highlightedIds]);

  const count = showing ? 0 : newRequestsCount({ arrivedIds, shownIds, serverExtra });
  return { count, live, show, highlightedIds };
}
