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

/** English default + Greek alternate (crossfade). Dark variant stays single-asset. */
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
}: GesyProviderBadgeProps) {
  const title = titleProp ?? DEFAULT_GESY_TOOLTIP;
  const height = HEIGHT_PX[size];
  const heightClass = HEIGHT_CLASS[size];

  if (variant === "dark") {
    const logo = LOGO.dark;
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
          className={`w-auto max-w-full object-contain object-left mix-blend-screen brightness-110 contrast-125 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${heightClass}`}
        />
      </span>
    );
  }

  // Size to the Greek logo; English scales down inside the same frame.
  const width = Math.round(height * LOGO.light.el.aspect);
  const imgClass = `h-full w-full object-contain object-left`;

  return (
    <span
      className={`inline-flex max-w-full cursor-help items-center ${className}`}
      title={title}
    >
      <span
        className="gesy-badge-bilingual relative inline-block max-w-full"
        style={{ width, height }}
      >
        <Image
          src={LOGO.light.en.src}
          alt="GESY — accepts GESY patients"
          width={width}
          height={height}
          className={`gesy-badge-logo-en absolute inset-0 origin-left scale-90 ${imgClass}`}
          priority={false}
        />
        <Image
          src={LOGO.light.el.src}
          alt=""
          width={width}
          height={height}
          className={`gesy-badge-logo-el absolute inset-0 ${imgClass}`}
          aria-hidden
          priority={false}
        />
      </span>
    </span>
  );
}
