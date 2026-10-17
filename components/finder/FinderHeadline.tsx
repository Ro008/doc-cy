import { Plus_Jakarta_Sans } from "next/font/google";

const headlineFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: "800",
  display: "swap",
});

/**
 * The Finder's headline in the top strip (mockup R3; user, 2026-10-17): "Cyprus’ doctors,"
 * in navy and "in one search" in teal over a hand-drawn swoosh. Plus Jakarta Sans 800:
 * catches the eye, still sober for a medical site.
 */
export function FinderHeadline() {
  return (
    <p
      data-testid="finder-headline"
      className={`${headlineFont.className} mb-1.5 text-balance text-center text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#062F61] [.doccy-profile[data-scheme=dark]_&]:text-[#F8FAFC] sm:text-[30px] xl:text-[38px]`}
    >
      Cyprus’ doctors,{" "}
      <span className="relative inline-block whitespace-nowrap text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]">
        in one search
        <svg
          className="absolute -bottom-[0.32em] left-[-2%] h-[0.42em] w-[104%] overflow-visible stroke-[#5CCFD6] [.doccy-profile[data-scheme=dark]_&]:stroke-[#12B8C0]"
          viewBox="0 0 200 14"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M3 10 C 45 3, 120 2, 197 7" fill="none" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </span>
    </p>
  );
}
