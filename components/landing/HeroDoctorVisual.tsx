import Image from "next/image";
import { LANDING_HERO_DOCTOR_SRC } from "@/lib/finder-hero-images";

export function HeroDoctorVisual() {
  return (
    <aside className="relative hidden h-full min-h-0 w-full lg:block">
      <div
        className="relative flex h-full min-h-0 w-full items-end justify-center overflow-hidden"
        aria-hidden
      >
        <Image
          src={LANDING_HERO_DOCTOR_SRC}
          alt=""
          width={1200}
          height={800}
          priority
          sizes="(max-width: 1024px) 0px, 580px"
          className="h-full w-auto max-w-none object-contain object-bottom"
        />
      </div>
    </aside>
  );
}
