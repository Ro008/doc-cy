type FinderResultsTransitionProps = {
  children: React.ReactNode;
};

/**
 * Results wrapper for finder/clinics pages.
 * Loading feedback lives in the top NavigationProgressBar + disabled filter form —
 * avoid floating pills that overlap page content.
 */
export function FinderResultsTransition({ children }: FinderResultsTransitionProps) {
  return <>{children}</>;
}
