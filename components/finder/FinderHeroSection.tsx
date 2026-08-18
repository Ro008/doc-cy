import Image from "next/image";
import { FINDER_HERO_COPY_TOP_CLASS } from "@/components/finder/FinderHeroBookingFlow";
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
      <div className="relative pb-2 sm:pb-6 lg:pb-8">
        {/* sm+ — decorative hero image (hidden on mobile for readable copy) */}
        <div className="relative hidden aspect-[16/11] w-full overflow-visible sm:ml-[24%] sm:block sm:w-[76%] lg:ml-[40%] lg:w-[62%] lg:aspect-[2.15/1]">
          <Image
            src={heroImageSrc}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 0px, 860px"
            className="object-contain object-right object-top"
            aria-hidden
          />
        </div>

        {/* Copy — in document flow on mobile; overlays image from sm up */}
        <header
          className={`mb-2 max-w-2xl sm:absolute sm:mb-0 sm:left-0 sm:z-10 sm:flex sm:w-[min(100%,27rem)] sm:flex-col sm:pb-3 sm:pr-4 lg:w-[45%] lg:max-w-xl lg:pb-4 lg:pl-1 lg:pr-6 ${FINDER_HERO_COPY_TOP_CLASS}`}
        >
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl lg:text-[2.35rem] lg:leading-[1.12]">
            {title}
          </h1>
          <p className={subtitleClassName}>{subtitle}</p>
        </header>

        {children ? <div className="relative z-20 sm:-mt-4 lg:-mt-6">{children}</div> : null}
      </div>
    </div>
  );
}
