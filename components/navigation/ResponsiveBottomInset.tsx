"use client";

type ResponsiveBottomInsetProps = {
  enabled: boolean;
  children: React.ReactNode;
};

export function ResponsiveBottomInset({ enabled, children }: ResponsiveBottomInsetProps) {
  return (
    <div
      className={enabled ? "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : undefined}
    >
      {children}
    </div>
  );
}
