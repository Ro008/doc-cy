"use client";

import { useEffect, useRef, useState } from "react";

import type { ApprovalCelebrationContent } from "@/lib/approval-celebration";
import {
  confettiAlpha,
  createConfettiBurst,
  stepConfetti,
  type ConfettiParticle,
} from "@/lib/confetti";

type Props = ApprovalCelebrationContent & {
  onClose: () => void;
};

/**
 * Shown when a founder approves a registration (user, 2026-10-15): a dialog with confetti
 * cannons from both bottom corners. Approvals are one a day at most, so it may stop the
 * founder for a click. Closes with Done, Escape or the backdrop. Without motion (the
 * system asks for reduced motion) it is the dialog alone.
 */
export function ApprovalCelebration({ title, detail, profilePath, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const frame = requestAnimationFrame(() => setShown(true));
    doneRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const fit = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);

    let particles: ConfettiParticle[] = [];
    const cannons = (count: number, speed: number, lean: number) => {
      const { width, height } = canvas;
      particles = particles.concat(
        createConfettiBurst(count, { x: width * 0.06, y: height }, { angle: -Math.PI / 2 + lean, spread: 0.75, speed }),
        createConfettiBurst(count, { x: width * 0.94, y: height }, { angle: -Math.PI / 2 - lean, spread: 0.75, speed }),
      );
    };
    cannons(60, Math.min(15, canvas.height / 40), 0.5);
    const second = window.setTimeout(() => cannons(40, Math.min(12, canvas.height / 48), 0.55), 260);

    let raf = 0;
    const tick = () => {
      particles = stepConfetti(particles, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = confettiAlpha(p);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.h / 1.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = particles.length > 0 || performance.now() < startedAt + 400 ? requestAnimationFrame(tick) : 0;
    };
    const startedAt = performance.now();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(second);
      window.removeEventListener("resize", fit);
    };
  }, [reducedMotion]);

  return (
    <>
      <div
        data-testid="approval-celebration-backdrop"
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 ${
          reducedMotion ? "" : "transition-opacity duration-300"
        } ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-celebration-title"
          className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center text-slate-200"
          style={{
            transform: reducedMotion || shown ? "scale(1)" : "scale(0.88)",
            transition: reducedMotion ? undefined : "transform 450ms cubic-bezier(0.2, 1.5, 0.4, 1)",
          }}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 id="approval-celebration-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          {detail ? <p className="mt-1 text-sm text-slate-300">{detail}</p> : null}
          <p className="mt-1 text-sm text-slate-400">The profile is public.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {profilePath ? (
              <a
                href={profilePath}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Open profile
              </a>
            ) : null}
            <button
              ref={doneRef}
              type="button"
              onClick={onClose}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Done
            </button>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]" />
    </>
  );
}
