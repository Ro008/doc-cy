import Image from "next/image";

type GesyProviderBadgeProps = {
  className?: string;
  /** `xs` = inline next to a heading; `sm` = card / secondary surfaces */
  size?: "xs" | "sm" | "md";
  /** Shown on hover (native tooltip); keep short for readability */
  title?: string;
  /** `light` for white/pale surfaces; `dark` for ink/slate backgrounds */
  variant?: "light" | "dark";
};

const HEIGHT_PX = { xs: 36, sm: 44, md: 52 } as const;

const HEIGHT_CLASS = {
  xs: "h-9",
  sm: "h-11",
  md: "h-[52px]",
} as const;

const LOGO = {
  light: {
    src: "/brand/gesy-logo.png",
    aspect: 600 / 450,
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
}: GesyProviderBadgeProps) {
  const title = titleProp ?? DEFAULT_GESY_TOOLTIP;
  const logo = LOGO[variant];
  const height = HEIGHT_PX[size];
  const width = Math.round(height * logo.aspect);

  return (
    <span
      className={`inline-flex max-w-full cursor-help items-center ${className}`}
      title={title}
    >
      <Image
        src={logo.src}
        alt="GESY — accepts GESY patients"
        width={width}
        height={height}
        className={`w-auto max-w-full object-contain object-left ${HEIGHT_CLASS[size]} ${
          variant === "dark"
            ? "mix-blend-screen brightness-110 contrast-125 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
            : ""
        }`.trim()}
      />
    </span>
  );
}
