import Image from "next/image";

const LOGO_SRC = "/brand/doccy-logo.png";
const LOGO_ASPECT = 483 / 140;

type DocCyWordmarkProps = {
  className?: string;
  /** Kept for call-site compatibility; single artwork works on light and dark surfaces. */
  variant?: "light" | "dark";
  /** `sm` = compact headers; `md` = default; `lg` = blog / marketing hero headers */
  size?: "sm" | "md" | "lg";
};

const HEIGHT_PX = { sm: 24, md: 28, lg: 36 } as const;
const HEIGHT_CLASS = { sm: "h-6", md: "h-7", lg: "h-9" } as const;

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
        alt="DocCy"
        width={width}
        height={height}
        className={`w-auto object-contain object-left ${HEIGHT_CLASS[size]}`}
      />
    </span>
  );
}
