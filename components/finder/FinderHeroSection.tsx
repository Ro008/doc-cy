import Image from "next/image";
import {
  FINDER_HERO_COPY_TOP_CLASS,
  FinderHeroBookingFlow,
} from "@/components/finder/FinderHeroBookingFlow";

type FinderHeroSectionProps = {
  title: string;
  subtitle: React.ReactNode;
  subtitleClassName?: string;
  showHeroImage?: boolean;
  /** Optional content under the hero (legacy). Prefer sibling full-bleed search bar. */
  children?: React.ReactNode;
};

export function FinderHeroSection({
  title,
  subtitle,
  subtitleClassName = "mt-3 max-w-2xl text-base leading-relaxed text-ink-600",
  showHeroImage = false,
  children,
}: FinderHeroSectionProps) {
  if (!showHeroImage) {
    return (
      <div>
        <header className="mb-6 sm:mb-8">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
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
        {/* sm+ — decorative hero image + booking flow (hidden on mobile for readable copy) */}
        <div className="relative hidden aspect-[16/11] w-full -translate-y-[14%] overflow-visible sm:ml-[28%] sm:block sm:w-[72%] lg:ml-[44%] lg:w-[58%] lg:aspect-[2.15/1]">
          <Image
            src="/finder/finder-hero.png"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 0px, 860px"
            className="origin-top-right scale-[1.2] object-contain object-right object-top [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]"
            aria-hidden
          />
          <FinderHeroBookingFlow />
        </div>

        {/* Copy — in document flow on mobile; overlays image from sm up */}
        <header
          className={`mb-2 max-w-2xl sm:absolute sm:mb-0 sm:left-0 sm:z-10 sm:flex sm:w-[min(100%,27rem)] sm:flex-col sm:pb-3 sm:pr-4 lg:w-[45%] lg:max-w-xl lg:pb-4 lg:pl-1 lg:pr-6 ${FINDER_HERO_COPY_TOP_CLASS}`}
        >
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl lg:text-[2.35rem] lg:leading-[1.12]">
            {title}
          </h1>
          <p className={subtitleClassName}>{subtitle}</p>
        </header>

        {children ? <div className="relative z-20 sm:-mt-4 lg:-mt-6">{children}</div> : null}
      </div>
    </div>
  );
}
