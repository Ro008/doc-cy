type FinderSearchBarProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed clinical search strip (DocCy tokens).
 */
export function FinderSearchBar({ children, className = "" }: FinderSearchBarProps) {
  return (
    <section
      data-testid="finder-search-bar"
      className={`w-full bg-clinical-600 text-white ${className}`.trim()}
    >
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        {children}
      </div>
    </section>
  );
}
