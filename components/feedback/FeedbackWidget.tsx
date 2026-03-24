"use client";

import * as React from "react";
import { HelpCircle, X, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DOCCY_OPEN_FEEDBACK_EVENT, type DocCyOpenFeedbackDetail } from "@/lib/doccy-feedback";

type Subject =
  | "I have a suggestion"
  | "Something isn't working"
  | "General Question"
  | "Founding Member Inquiry";

type HintStage = "off" | "anim-in" | "shown" | "anim-out";

function formspreeEndpoint(): string | null {
  const id = process.env.NEXT_PUBLIC_FORMSPREE_ID;
  if (!id) return null;
  return `https://formspree.io/f/${id}`;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createClientComponentClient(), []);

  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState<Subject>("I have a suggestion");
  const [message, setMessage] = React.useState("");
  const [userId, setUserId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [hintStage, setHintStage] = React.useState<HintStage>("off");
  const [reduceMotion, setReduceMotion] = React.useState(false);

  const currentUrl =
    typeof window === "undefined"
      ? pathname ?? ""
      : `${window.location.origin}${pathname ?? ""}`;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    function onOpenFeedback(e: Event) {
      const ce = e as CustomEvent<DocCyOpenFeedbackDetail>;
      const next = ce.detail?.subject;
      if (next === "Founding Member Inquiry") {
        setSubject("Founding Member Inquiry");
      } else {
        setSubject("I have a suggestion");
      }
      setMessage("");
      setError(null);
      setSent(false);
      setOpen(true);
      setHintStage("off");
    }
    window.addEventListener(DOCCY_OPEN_FEEDBACK_EVENT, onOpenFeedback);
    return () => window.removeEventListener(DOCCY_OPEN_FEEDBACK_EVENT, onOpenFeedback);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setUserId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  React.useEffect(() => {
    if (reduceMotion || open) return;

    let cancelled = false;
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let onScroll: (() => void) | undefined;

    const armHintDelay = () => {
      if (cancelled) return;
      hintTimer = window.setTimeout(() => {
        if (!cancelled) setHintStage("anim-in");
      }, 3000);
    };

    const tryArmWhenStableAtTop = () => {
      if (cancelled || typeof window === "undefined") return;
      if (window.scrollY <= 12) {
        armHintDelay();
        return;
      }
      onScroll = () => {
        if (cancelled || !onScroll) return;
        if (window.scrollY <= 12) {
          window.removeEventListener("scroll", onScroll);
          onScroll = undefined;
          if (fallbackTimer !== undefined) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
          }
          armHintDelay();
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      fallbackTimer = window.setTimeout(() => {
        if (onScroll) {
          window.removeEventListener("scroll", onScroll);
          onScroll = undefined;
        }
        armHintDelay();
      }, 12000);
    };

    const afterLoadAndPaint = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          tryArmWhenStableAtTop();
        });
      });
    };

    if (document.readyState === "complete") {
      afterLoadAndPaint();
    } else {
      window.addEventListener("load", afterLoadAndPaint, { once: true });
    }

    return () => {
      cancelled = true;
      if (hintTimer !== undefined) window.clearTimeout(hintTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      if (onScroll) window.removeEventListener("scroll", onScroll);
    };
  }, [reduceMotion, open]);

  React.useEffect(() => {
    if (hintStage !== "shown" || open) return;
    const t = window.setTimeout(() => setHintStage("anim-out"), 5000);
    return () => window.clearTimeout(t);
  }, [hintStage, open]);

  function onHintAnimationEnd() {
    setHintStage((prev) => {
      if (prev === "anim-in") return "shown";
      if (prev === "anim-out") return "off";
      return prev;
    });
  }

  function resetForm() {
    setSubject("I have a suggestion");
    setMessage("");
    setError(null);
    setSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const endpoint = formspreeEndpoint();
    if (!endpoint) {
      setError(
        "Support is not configured yet. Please set NEXT_PUBLIC_FORMSPREE_ID."
      );
      return;
    }

    if (!message.trim()) {
      setError("Please write a short message.");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("message", message);
      fd.append("url", currentUrl);
      fd.append("user_id", userId ?? "");

      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error ||
          data?.message ||
          "Something went wrong. Please try again.";
        setError(String(msg));
        return;
      }

      setSent(true);
    } catch (err) {
      console.error("[Feedback] Submit failed", err);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const showHintBubble =
    !reduceMotion && (hintStage === "anim-in" || hintStage === "shown" || hintStage === "anim-out");

  return (
    <>
      {/* Floating help: mint button + timed tooltip to the left */}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-row-reverse items-center gap-2 sm:bottom-6 sm:right-6">
        {showHintBubble && (
          <div
            role="tooltip"
            className={[
              "doccy-feedback-hint-bubble pointer-events-none relative max-w-[200px] rounded-2xl border border-emerald-400/25 bg-slate-900/92 px-3.5 py-2 text-left text-xs font-medium leading-snug text-emerald-50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55),0_0_24px_-6px_rgba(52,211,153,0.35)] backdrop-blur-md",
              hintStage === "anim-in" ? "doccy-feedback-hint-pop-in" : "",
              hintStage === "shown" ? "doccy-feedback-hint-settled" : "",
              hintStage === "anim-out" ? "doccy-feedback-hint-pop-out" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onAnimationEnd={onHintAnimationEnd}
          >
            <span className="block pr-0.5">Suggestions or Help?</span>
            <span
              className="absolute -right-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-emerald-400/25 bg-slate-900/92"
              aria-hidden
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
            setHintStage("off");
          }}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-emerald-300/45 bg-emerald-400 text-slate-950 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_4px_24px_rgba(16,185,129,0.35)] transition hover:border-emerald-200/60 hover:bg-emerald-300 hover:shadow-[0_0_0_1px_rgba(110,231,183,0.45),0_6px_28px_rgba(52,211,153,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          aria-label="Suggestions or help — open form"
        >
          <HelpCircle className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-label="Close feedback modal"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
          />

          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-emerald-300/20 bg-slate-900/95 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-300/90">
                  DocCy · Support
                </p>
                <h3
                  id="feedback-dialog-title"
                  className="mt-1 text-base font-semibold text-slate-50"
                >
                  How can we help you, Doctor?
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Share an idea, ask a question, or tell us if something
                  doesn&apos;t feel right — we read every message.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60 text-slate-300 transition hover:border-emerald-400/35 hover:bg-emerald-400/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="px-5 py-5">
              {sent ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/12 px-3 py-1 text-[11px] font-medium tracking-[0.25em] text-emerald-200">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    SENT
                  </div>
                  <p className="text-sm font-medium text-slate-50">
                    Thanks — we received your message.
                  </p>
                  <p className="text-xs text-slate-400">
                    We&apos;ll follow up as soon as possible.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                      className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-emerald-300/40 bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                      {error}
                    </div>
                  )}

                  <div className="block text-xs font-medium text-slate-200">
                    Topic
                    {subject === "Founding Member Inquiry" ? (
                      <div className="mt-1 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-3 py-2.5">
                        <p className="text-sm font-medium text-emerald-100">
                          Founding Member Inquiry
                        </p>
                        <button
                          type="button"
                          onClick={() => setSubject("I have a suggestion")}
                          className="mt-1.5 text-[11px] text-slate-400 underline decoration-slate-500 underline-offset-2 transition hover:text-slate-300"
                        >
                          Use a different topic
                        </button>
                      </div>
                    ) : (
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value as Subject)}
                        className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="I have a suggestion">
                          I have a suggestion
                        </option>
                        <option value={"Something isn't working"}>
                          Something isn&apos;t working
                        </option>
                        <option value="General Question">General Question</option>
                      </select>
                    )}
                  </div>

                  <label className="block text-xs font-medium text-slate-200">
                    Message
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      className="mt-1 w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Tell us your idea or describe the issue..."
                    />
                  </label>

                  <input type="hidden" name="url" value={currentUrl} />
                  <input type="hidden" name="user_id" value={userId ?? ""} />

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300/40 bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_4px_22px_rgba(16,185,129,0.32)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      {submitting ? "Sending..." : "Send message"}
                    </button>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Context included: page URL and your user ID (if signed in).
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
