import Image from "next/image";

const LOGO_SRC = "/brand/doccy-logo.png";
/** Trimmed wordmark aspect (1518×461). */
const LOGO_ASPECT = 1518 / 461;

type DocCyWordmarkProps = {
  className?: string;
  /** Kept for call-site compatibility; single artwork works on light and dark surfaces. */
  variant?: "light" | "dark";
  /** `sm` = compact headers; `md` = default; `lg` = blog / marketing; `xl` = finder (~1.5× md) */
  size?: "sm" | "md" | "lg" | "xl";
};

const HEIGHT_PX = { sm: 24, md: 28, lg: 36, xl: 42 } as const;
const HEIGHT_CLASS = { sm: "h-6", md: "h-7", lg: "h-9", xl: "h-[42px]" } as const;

export function DocCyWordmark({
  className = "",
  variant: _variant = "dark",
  size = "md",
}: DocCyWordmarkProps) {
  const height = HEIGHT_PX[size];
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`.trim()}>
      <Image
        src={LOGO_SRC}
        alt="my doccy"
        width={width}
        height={height}
        className={`w-auto object-contain object-left ${HEIGHT_CLASS[size]}`}
        priority={size === "lg"}
      />
    </span>
  );
}
