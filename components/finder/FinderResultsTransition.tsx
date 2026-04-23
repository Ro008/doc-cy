"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START_EVENT = "doccy:navigation-start";

type FinderResultsTransitionProps = {
  children: React.ReactNode;
};

export function FinderResultsTransition({ children }: FinderResultsTransitionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  React.useEffect(() => {
    function onStart() {
      setIsTransitioning(true);
    }
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  React.useEffect(() => {
    setIsTransitioning(false);
  }, [pathname, searchParams]);

  return (
    <div
      className={`transition-opacity duration-200 ease-out ${
        isTransitioning ? "opacity-55" : "opacity-100"
      }`}
    >
      {children}
    </div>
  );
}

