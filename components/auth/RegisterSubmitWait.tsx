"use client";

import * as React from "react";
import {
  registerSubmitWaitBeatAt,
  registerSubmitWaitProgressPercent,
} from "@/lib/register-submit-wait";

const SLOT_COUNT = 21;

export function RegisterSubmitWait({ timedOut }: { timedOut: boolean }) {
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - started), 400);
    return () => window.clearInterval(id);
  }, []);

  const beat = registerSubmitWaitBeatAt(elapsedMs);
  const progress = registerSubmitWaitProgressPercent(elapsedMs);

  if (timedOut) {
    return (
      <div>
        <p className="text-sm font-semibold text-ink-900">This is taking longer than expected</p>
        <p className="mt-1 text-sm text-ink-600">
          Keep this tab open, or refresh and try again if nothing happens.
        </p>
      </div>
    );
  }

  return (
    <div className="w-[min(22.5rem,calc(100vw-2.5rem))] text-center">
      <div className="mx-auto grid w-[9.5rem] grid-cols-7 gap-1.5" aria-hidden>
        {Array.from({ length: SLOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="register-wait-slot h-3.5 rounded-[5px] bg-clinical-100"
            style={{ animationDelay: `${index * 85}ms` }}
          />
        ))}
      </div>
      <p className="mt-5 text-lg font-semibold tracking-tight text-ink-900">{beat.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{beat.detail}</p>
      <div
        className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Submitting your application"
      >
        <div
          className="h-full rounded-full bg-clinical-500 transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
