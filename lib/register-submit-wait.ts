export type RegisterSubmitWaitBeat = {
  title: string;
  detail: string;
};

export const REGISTER_SUBMIT_WAIT_BEATS: readonly RegisterSubmitWaitBeat[] = [
  {
    title: "Creating your account",
    detail: "Setting up a secure login for you.",
  },
  {
    title: "Saving your clinic",
    detail: "Photo, specialty, and address are going in.",
  },
  {
    title: "Writing your confirmation email",
    detail: "One click to confirm — not a code.",
  },
  {
    title: "Keep this tab open",
    detail: "This usually takes a few more seconds.",
  },
] as const;

export const REGISTER_SUBMIT_WAIT_BEAT_MS = 2400;

export function registerSubmitWaitBeatAt(
  elapsedMs: number,
  beats: readonly RegisterSubmitWaitBeat[] = REGISTER_SUBMIT_WAIT_BEATS,
): RegisterSubmitWaitBeat {
  if (beats.length === 0) {
    return { title: "Submitting your application", detail: "Please keep this tab open." };
  }
  const index = Math.min(beats.length - 1, Math.floor(Math.max(0, elapsedMs) / REGISTER_SUBMIT_WAIT_BEAT_MS));
  return beats[index]!;
}

/** Never reaches 100% — the redirect is the real finish. */
export function registerSubmitWaitProgressPercent(elapsedMs: number): number {
  const beats = REGISTER_SUBMIT_WAIT_BEATS.length;
  const index = Math.min(
    beats - 1,
    Math.floor(Math.max(0, elapsedMs) / REGISTER_SUBMIT_WAIT_BEAT_MS),
  );
  return Math.min(90, 18 + index * 24);
}
