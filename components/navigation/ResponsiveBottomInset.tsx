"use client";

import { usePathname } from "next/navigation";

type ResponsiveBottomInsetProps = {
  enabled: boolean;
  children: React.ReactNode;
};

function isLandingPath(pathname: string): boolean {
  return pathname === "/" || /^\/(en|el)\/?$/.test(pathname);
}

export function ResponsiveBottomInset({ enabled, children }: ResponsiveBottomInsetProps) {
  const pathname = usePathname();
  const shouldApplyInset = enabled && !isLandingPath(pathname);

  return (
    <div
      className={shouldApplyInset ? "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : undefined}
    >
      {children}
    </div>
  );
}
