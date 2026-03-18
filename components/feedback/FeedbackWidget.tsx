"use client";

import * as React from "react";
import { HelpCircle, X, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Subject = "Bug" | "Feature Request" | "Question";

function formspreeEndpoint(): string | null {
  const id = process.env.NEXT_PUBLIC_FORMSPREE_ID;
  if (!id) return null;
  return `https://formspree.io/f/${id}`;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createClientComponentClient(), []);

  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState<Subject>("Bug");
  const [message, setMessage] = React.useState("");
  const [userId, setUserId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const currentUrl =
    typeof window === "undefined"
      ? pathname ?? ""
      : `${window.location.origin}${pathname ?? ""}`;

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

  function resetForm() {
    setSubject("Bug");
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

  return (
    <>
      {/* Floating bubble */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Feedback"
      >
        <HelpCircle className="h-5 w-5" aria-hidden />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
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

          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-emerald-100/10 bg-slate-900/95 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald-200/80">
                  SUPPORT
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-50">
                  Feedback & help
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  We are always looking to improve. Share your thoughts, questions,
                  or report an issue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60 text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="px-5 py-5">
              {sent ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.25em] text-emerald-200">
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
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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

                  <label className="block text-xs font-medium text-slate-200">
                    Subject
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as Subject)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    >
                      <option value="Bug">Bug</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Question">Question</option>
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-slate-200">
                    Message
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      className="mt-1 w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Tell us what's on your mind..."
                    />
                  </label>

                  {/* Context fields sent to Formspree */}
                  <input type="hidden" name="url" value={currentUrl} />
                  <input type="hidden" name="user_id" value={userId ?? ""} />

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      {submitting ? "Sending..." : "Send feedback"}
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

