import Image from "next/image";

export function HeroDoctorVisual() {
  return (
    <aside className="relative hidden h-full min-h-0 w-full lg:block">
      <div
        className="relative flex h-full min-h-0 w-full items-end justify-center overflow-hidden"
        aria-hidden
      >
        <Image
          src="/landing/hero-doctor.png"
          alt=""
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 1024px) 0px, 580px"
          className="h-full w-auto max-w-none object-contain object-bottom"
        />
      </div>
    </aside>
  );
}
