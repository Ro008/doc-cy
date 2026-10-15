import Image from "next/image";
import { FINDER_PROFESSIONALS_HERO_SRC } from "@/lib/finder-hero-images";

type FinderHeroSectionProps = {
  title: string;
  subtitle: React.ReactNode;
  subtitleClassName?: string;
  showHeroImage?: boolean;
  /** Defaults to the professionals finder hero. */
  heroImageSrc?: string;
  /** Optional content under the hero (legacy). Prefer sibling full-bleed search bar. */
  children?: React.ReactNode;
};

/**
 * A short hero so the search bar and the first results show without scrolling (user,
 * 2026-10-15): copy on the left, the picture on the right standing on the search bar.
 * The picture never sits under the copy. Phones and small tablets show the copy only.
 */
export function FinderHeroSection({
  title,
  subtitle,
  subtitleClassName = "mt-3 max-w-2xl text-base leading-relaxed text-ink-600",
  showHeroImage = false,
  heroImageSrc = FINDER_PROFESSIONALS_HERO_SRC,
  children,
}: FinderHeroSectionProps) {
  if (!showHeroImage) {
    return (
      <div>
        <header className="mb-6 sm:mb-8">
          <h1 className="max-w-3xl text-balance text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            {title}
          </h1>
          <p className={subtitleClassName}>{subtitle}</p>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div>
      <div data-testid="finder-hero" className="flex items-end justify-between gap-8">
        <header className="min-w-0 max-w-2xl pb-6 pt-4 sm:pb-8 sm:pt-6 lg:pb-9 lg:pt-6">
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl lg:text-[2.35rem] lg:leading-[1.12]">
            {title}
          </h1>
          <p className={subtitleClassName}>{subtitle}</p>
        </header>

        {/* Decorative; its bottom edge rests on the search bar. 1515 × 1038 picture. */}
        <div className="relative hidden shrink-0 md:block md:h-[200px] md:w-[292px] lg:h-[230px] lg:w-[336px]">
          <Image
            src={heroImageSrc}
            alt=""
            fill
            priority
            sizes="336px"
            className="object-contain object-bottom"
            aria-hidden
          />
        </div>
      </div>

      {children ? <div className="relative z-20">{children}</div> : null}
    </div>
  );
}
