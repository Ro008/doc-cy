import Image from "next/image";

type GesyProviderBadgeProps = {
  className?: string;
  /**
   * `xs` = inline next to a heading; `sm` = card / secondary surfaces; `line` = in a line
   * of text (G's finder card), drawn at its real size so it takes no more room than it shows.
   */
  size?: "line" | "xs" | "sm" | "md";
  /** Instant custom tooltip on hover (not the delayed native `title`). */
  title?: string;
  /**
   * `light` for white/pale surfaces; `dark` for ink/slate backgrounds; `mono` = the Greek
   * mark in one navy, for coloured surfaces where its teal corner would vanish (profile hero).
   */
  variant?: "light" | "dark" | "mono";
  /**
   * Logo language. Finder lists use English; individual profile pages use Greek.
   * Defaults to English.
   */
  language?: "en" | "el";
  /**
   * Which edge of the mark the tooltip lines up with. `right` opens it leftwards, for a mark
   * at the end of a row on a phone (the finder card), where it would run off the screen.
   */
  tooltipAlign?: "left" | "right";
};

const HEIGHT_PX = { line: 25, xs: 36, sm: 44, md: 52 } as const;

const HEIGHT_CLASS = {
  line: "h-[25px]",
  xs: "h-9",
  sm: "h-11",
  md: "h-[52px]",
} as const;

const LOGO = {
  light: {
    en: { src: "/brand/GesyEN.png", aspect: 786 / 450 },
    // The same mark with white text, for a public page in dark mode (swapped by CSS).
    enOnDark: { src: "/brand/gesy-logo-en-on-dark.png", aspect: 786 / 450 },
    // Filename bumps cache after transparency fix (old gesy-logo.png may linger in Next/Image).
    el: { src: "/brand/gesy-logo-el.png", aspect: 600 / 450 },
    elOnDark: { src: "/brand/gesy-logo-el-on-dark.png", aspect: 600 / 450 },
  },
  dark: {
    src: "/brand/gesy-logo-dark.png",
    aspect: 197 / 112,
  },
  mono: {
    en: { src: "/brand/gesy-logo-en-navy.png", aspect: 786 / 450 },
    el: { src: "/brand/gesy-logo-el-navy.png", aspect: 600 / 450 },
  },
} as const;

const DEFAULT_GESY_TOOLTIP =
  "This professional accepts patients through Cyprus GESY (the national health system).";

export function GesyProviderBadge({
  className = "",
  size = "sm",
  title: titleProp,
  variant = "light",
  language = "en",
  tooltipAlign = "left",
}: GesyProviderBadgeProps) {
  const title = titleProp ?? DEFAULT_GESY_TOOLTIP;
  const height = HEIGHT_PX[size];
  const heightClass = HEIGHT_CLASS[size];

  const logo =
    variant === "dark"
      ? LOGO.dark
      : variant === "mono"
        ? LOGO.mono[language]
        : language === "el"
        ? LOGO.light.el
        : LOGO.light.en;
  const width = Math.round(height * logo.aspect);
  // English mark reads larger than the Greek asset at the same height.
  const scaleClass =
    variant === "light" && language === "en" && size !== "line" ? "origin-left scale-[0.69]" : "";
  // On a dark public page the mark swaps to its white-text copy; multiply would turn
  // any mark black there, so it applies in light only.
  const swapsOnDark = variant === "light";
  const onDark = language === "el" ? LOGO.light.elOnDark : LOGO.light.enOnDark;

  return (
    <span
      className={`group relative inline-flex max-w-full cursor-help items-center ${className}`}
    >
      <Image
        src={logo.src}
        alt="GESY — accepts GESY patients"
        width={width}
        height={height}
        className={`w-auto max-w-full object-contain object-left ${heightClass} ${scaleClass} ${
          variant === "dark"
            ? "mix-blend-screen brightness-110 contrast-125 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
            : variant === "mono"
              ? ""
              : "mix-blend-multiply [.doccy-profile[data-scheme=dark]_&]:mix-blend-normal"
        } ${swapsOnDark ? "[.doccy-profile[data-scheme=dark]_&]:hidden" : ""}`}
        priority={false}
      />
      {swapsOnDark ? (
        <Image
          src={onDark.src}
          alt="GESY — accepts GESY patients"
          width={width}
          height={height}
          className={`hidden w-auto max-w-full object-contain object-left ${heightClass} ${scaleClass} [.doccy-profile[data-scheme=dark]_&]:block`}
          priority={false}
        />
      ) : null}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${tooltipAlign === "right" ? "right-0" : "left-0"} top-full z-20 mt-1.5 w-56 max-w-[min(14rem,calc(100vw-1.5rem))] rounded-md border border-site-ink-200 bg-site-white px-2.5 py-2 text-left text-[11px] font-medium leading-snug text-site-ink-700 opacity-0 shadow-md group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {title}
      </span>
    </span>
  );
}
