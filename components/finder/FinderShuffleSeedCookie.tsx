"use client";

import { useEffect } from "react";
import { writeFinderShuffleSeedCookie } from "@/lib/finder-shuffle-seed";

/** Persist the server-generated shuffle seed so Show more keeps the same tied order. */
export function FinderShuffleSeedCookie({
  seed,
  persist,
}: {
  seed: string;
  persist: boolean;
}) {
  useEffect(() => {
    if (!persist) return;
    writeFinderShuffleSeedCookie(seed);
  }, [persist, seed]);
  return null;
}
