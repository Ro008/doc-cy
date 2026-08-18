import type { ReactNode } from "react";
import { Caveat } from "next/font/google";

const bookOnlineScript = Caveat({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
});

const SIZE_CLASS = {
  /** Marketing hero — flourish can sit close to the H1. */
  hero: "mt-1 text-[1.9rem] leading-[1.05] sm:text-[2.25rem] lg:text-[2.5rem]",
  /** Results header — H1 stays dominant; script reads as a signature. */
  compact: "mt-0.5 text-[1.5rem] leading-[1.1] sm:text-[1.7rem] lg:text-[1.8rem]",
} as const;

/** Handwritten accent under the finder subtitle. */
export function FinderHeroBookOnlineLine({
  size = "hero",
  children = "and book online.",
}: {
  size?: keyof typeof SIZE_CLASS;
  children?: ReactNode;
}) {
  return (
    <span
      className={`${bookOnlineScript.className} block text-clinical-600 ${SIZE_CLASS[size]}`}
    >
      {children}
    </span>
  );
}
