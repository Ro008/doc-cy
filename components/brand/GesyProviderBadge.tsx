import Image from "next/image";

type GesyProviderBadgeProps = {
  className?: string;
  /** `xs` = inline next to a heading; `sm` = card / secondary surfaces */
  size?: "xs" | "sm" | "md";
  /** Instant custom tooltip on hover (not the delayed native `title`). */
  title?: string;
  /** `light` for white/pale surfaces; `dark` for ink/slate backgrounds */
  variant?: "light" | "dark";
  /**
   * Logo language. Finder lists use English; individual profile pages use Greek.
   * Defaults to English.
   */
  language?: "en" | "el";
};

const HEIGHT_PX = { xs: 36, sm: 44, md: 52 } as const;

const HEIGHT_CLASS = {
  xs: "h-9",
  sm: "h-11",
  md: "h-[52px]",
} as const;

const LOGO = {
  light: {
    en: { src: "/brand/GesyEN.png", aspect: 786 / 450 },
    el: { src: "/brand/gesy-logo.png", aspect: 600 / 450 },
  },
  dark: {
    src: "/brand/gesy-logo-dark.png",
    aspect: 197 / 112,
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
}: GesyProviderBadgeProps) {
  const title = titleProp ?? DEFAULT_GESY_TOOLTIP;
  const height = HEIGHT_PX[size];
  const heightClass = HEIGHT_CLASS[size];

  const logo =
    variant === "dark"
      ? LOGO.dark
      : language === "el"
        ? LOGO.light.el
        : LOGO.light.en;
  const width = Math.round(height * logo.aspect);
  // English mark reads larger than the Greek asset at the same height.
  const scaleClass =
    variant === "light" && language === "en" ? "origin-left scale-[0.69]" : "";

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
            : ""
        }`}
        priority={false}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-56 max-w-[min(14rem,calc(100vw-1.5rem))] rounded-md border border-ink-200 bg-white px-2.5 py-2 text-left text-[11px] font-medium leading-snug text-ink-700 opacity-0 shadow-md group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {title}
      </span>
    </span>
  );
}
