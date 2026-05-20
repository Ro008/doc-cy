import Image from "next/image";

type GesyProviderBadgeProps = {
  className?: string;
  /** `xs` = inline next to a heading; `sm` = card / secondary surfaces */
  size?: "xs" | "sm" | "md";
  /** Shown on hover (native tooltip); keep short for readability */
  title?: string;
};

const HEIGHT_PX = { xs: 18, sm: 22, md: 26 } as const;
const WIDTH_PX = { xs: 54, sm: 66, md: 78 } as const;

const HEIGHT_CLASS = {
  xs: "h-[18px]",
  sm: "h-[22px]",
  md: "h-[26px]",
} as const;

/**
 * GESY mark for dark DocCy surfaces (finder cards, public profile).
 * Uses the light-on-dark artwork with blend so the black plate reads as transparent.
 */
const DEFAULT_GESY_TOOLTIP =
  "This professional accepts patients through Cyprus GESY (the national health system).";

export function GesyProviderBadge({
  className = "",
  size = "sm",
  title: titleProp,
}: GesyProviderBadgeProps) {
  const title = titleProp ?? DEFAULT_GESY_TOOLTIP;
  return (
    <span
      className={`inline-flex max-w-full cursor-help items-center ${className}`}
      title={title}
    >
      <Image
        src="/brand/gesy-logo-dark.png"
        alt="GESY — accepts GESY patients"
        width={WIDTH_PX[size]}
        height={HEIGHT_PX[size]}
        className={`w-auto max-w-full object-contain object-left ${HEIGHT_CLASS[size]} mix-blend-screen brightness-110 contrast-125 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]`}
      />
    </span>
  );
}
