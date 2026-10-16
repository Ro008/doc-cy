/**
 * Confetti physics for the approval celebration (user, 2026-10-15). Pure: the canvas
 * component only draws what these return, one frame at a time.
 */
export const CONFETTI_COLORS = ["#1D9E75", "#378ADD", "#EF9F27", "#D4537E", "#7F77DD", "#5DCAA5"] as const;

/** Pixels per frame, added to the downward speed every frame. */
export const CONFETTI_GRAVITY = 0.22;

const FADE_FRAMES = 30;
const OFFSCREEN_MARGIN = 20;

export type ConfettiParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  spin: number;
  color: string;
  age: number;
  life: number;
  /** Offsets the sideways flutter so the pieces don't sway together. */
  phase: number;
  round: boolean;
};

export type ConfettiBurst = {
  /** Radians; -π/2 is straight up. */
  angle: number;
  /** Width of the cone, in radians. */
  spread: number;
  speed: number;
  /** Frames; each particle adds up to 50 more. */
  life?: number;
};

export function createConfettiBurst(
  count: number,
  origin: { x: number; y: number },
  burst: ConfettiBurst,
  random: () => number = Math.random,
): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = burst.angle + (random() - 0.5) * burst.spread;
    const speed = burst.speed * (0.45 + random() * 0.75);
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 5 + random() * 5,
      h: 3 + random() * 4,
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 0.35,
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)],
      age: 0,
      life: (burst.life ?? 110) + random() * 50,
      phase: random() * Math.PI * 2,
      round: random() < 0.25,
    });
  }
  return particles;
}

/** One frame later: moved, pulled down, slowed by the air and aged; the spent ones are gone. */
export function stepConfetti(particles: readonly ConfettiParticle[], canvasHeight: number): ConfettiParticle[] {
  const next: ConfettiParticle[] = [];
  for (const p of particles) {
    const vx = p.vx * 0.985;
    const vy = (p.vy + CONFETTI_GRAVITY) * 0.99;
    const moved: ConfettiParticle = {
      ...p,
      vx,
      vy,
      x: p.x + vx + Math.sin(p.age * 0.12 + p.phase) * 0.7,
      y: p.y + vy,
      rotation: p.rotation + p.spin,
      age: p.age + 1,
    };
    if (moved.age < moved.life && moved.y < canvasHeight + OFFSCREEN_MARGIN) next.push(moved);
  }
  return next;
}

export function confettiAlpha(p: Pick<ConfettiParticle, "age" | "life">): number {
  return Math.max(0, Math.min(1, (p.life - p.age) / FADE_FRAMES));
}
