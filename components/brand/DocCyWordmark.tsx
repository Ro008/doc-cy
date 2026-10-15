import Image from "next/image";

const LOGO_SRC = { light: "/brand/doccy-logo.png", dark: "/brand/doccy-logo-on-dark.png" } as const;
/** Trimmed wordmark aspect (1518×461), shared by both artworks. */
const LOGO_ASPECT = 1518 / 461;

type DocCyWordmarkProps = {
  className?: string;
  /** Surface the logo sits on: `dark` uses the reverse artwork (white "my"). */
  variant?: "light" | "dark";
  /**
   * `md` = every header (user, 2026-10-15: one size site-wide, 32px from tablets up, 28px on
   * a phone so "Join as a professional" still fits beside it); `xl` = the for-professionals
   * sales page.
   */
  size?: "md" | "xl";
};

/** The larger of each size's heights: the image file is fetched at least this tall. */
const HEIGHT_PX = { md: 32, xl: 42 } as const;
const HEIGHT_CLASS = { md: "h-7 sm:h-8", xl: "h-[42px]" } as const;

export function DocCyWordmark({
  className = "",
  variant = "dark",
  size = "md",
}: DocCyWordmarkProps) {
  const height = HEIGHT_PX[size];
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`.trim()}>
      <Image
        src={LOGO_SRC[variant]}
        alt="my doccy"
        width={width}
        height={height}
        className={`w-auto object-contain object-left ${HEIGHT_CLASS[size]}`}
        priority
      />
    </span>
  );
}
