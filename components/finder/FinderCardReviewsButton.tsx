"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime } from "date-fns-tz";
import { X } from "lucide-react";
import { ProfileStars } from "@/components/doctor/profile/ProfileStars";
import { CY_TZ } from "@/lib/appointments";
import type { PublicReview } from "@/lib/public/profile-reviews";

type Loaded =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; count: number; average: number | null; reviews: PublicReview[] };

/**
 * "6 reviews" in the card's hero opens her reviews over the Finder (mockup L; user,
 * 2026-10-16), the same ones as on her profile, fetched on the first click. Escape, the
 * close button or a click outside closes it. Rendered in place (not in a portal) so it
 * keeps the page's light / dark colours.
 */
export function FinderCardReviewsButton({
  professionalId,
  name,
  count,
  profileHref = null,
}: {
  professionalId: string;
  name: string;
  count: number;
  profileHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>({ status: "idle" });
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = `${count} ${count === 1 ? "review" : "reviews"}`;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const show = async () => {
    setOpen(true);
    if (loaded.status === "ready" || loaded.status === "loading") return;
    setLoaded({ status: "loading" });
    try {
      const res = await fetch(`/api/directory/professional-reviews?professionalId=${encodeURIComponent(professionalId)}`);
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; count?: number; average?: number | null; reviews?: PublicReview[] }
        | null;
      if (!res.ok || !data?.ok || !Array.isArray(data.reviews)) {
        setLoaded({ status: "error" });
        return;
      }
      setLoaded({
        status: "ready",
        count: Number(data.count ?? data.reviews.length),
        average: typeof data.average === "number" ? data.average : null,
        reviews: data.reviews,
      });
    } catch {
      setLoaded({ status: "error" });
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="finder-card-reviews"
        aria-haspopup="dialog"
        onClick={show}
        className="text-[15px] font-semibold text-accent-on underline decoration-1 underline-offset-[3px] transition-none hover:decoration-2"
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(8,20,42,0.55)] px-3 py-6 sm:px-6 sm:py-20"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Reviews of ${name}`}
            data-testid="finder-card-reviews-dialog"
            className="w-full max-w-[560px] whitespace-normal rounded-3xl border border-profile-border bg-profile-surface p-6 text-left text-profile-body shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-accent-link">Reviews</p>
                <p className="mt-1 text-xl font-semibold text-profile-text">{name}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-profile-muted transition-none hover:bg-accent-soft"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {loaded.status === "ready" ? (
              <>
                <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-3.5">
                  <span className="text-[32px] font-extrabold tabular-nums text-profile-text">
                    {loaded.average?.toFixed(1)}
                  </span>
                  <span className="text-sm text-profile-text">
                    out of 5 · {loaded.count} {loaded.count === 1 ? "review" : "reviews"} from patients who booked through DocCy
                  </span>
                </div>
                <ul className="mt-3.5 flex flex-col gap-3">
                  {loaded.reviews.map((review) => (
                    <li key={review.id} className="rounded-2xl border border-profile-border px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <ProfileStars rating={review.rating} label={`${review.rating} out of 5 stars`} />
                        <span className="text-sm font-bold text-profile-text">{review.name}</span>
                        <time dateTime={review.createdAt} className="ml-auto text-[13px] text-profile-muted">
                          {format(utcToZonedTime(new Date(review.createdAt), CY_TZ), "d MMM yyyy", { locale: enGB })}
                        </time>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{review.comment}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : loaded.status === "error" ? (
              <p className="mt-4 text-sm text-profile-muted">The reviews could not be loaded. Please try again.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3" aria-busy="true">
                <div className="h-16 animate-pulse rounded-2xl bg-accent-soft" />
                <div className="h-20 animate-pulse rounded-2xl bg-profile-bg" />
              </div>
            )}

            {profileHref ? (
              <a href={profileHref} className="mt-4 inline-block text-sm font-bold text-accent-link hover:underline">
                See the full profile
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
