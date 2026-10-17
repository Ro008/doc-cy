import { MapPin, Search } from "lucide-react";

/**
 * The Finder's search row while a page loads: the same one-line fields as
 * `FinderHeaderSearch`, still (nothing to type into until the page arrives), so the
 * header does not jump when the real search replaces it.
 */
export function FinderHeaderSearchSkeleton() {
  return (
    <div className="w-full" aria-hidden>
      <div className="flex flex-col items-stretch rounded-[22px] border border-[#D3E2E6] bg-[#F3F8F9] p-1 [.doccy-profile[data-scheme=dark]_&]:border-[#2A4370] [.doccy-profile[data-scheme=dark]_&]:bg-[#0B1D38] md:flex-row md:rounded-full">
        <div className="flex h-11 min-w-0 items-center gap-2.5 px-3.5 md:h-[42px] md:flex-[1.25_1_0]">
          <Search className="h-[17px] w-[17px] shrink-0 text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]" strokeWidth={2} />
          <span className="truncate text-[15px] font-medium text-site-ink-500">Specialty or name</span>
        </div>
        <span className="my-2.5 hidden w-px shrink-0 bg-[#D3E2E6] [.doccy-profile[data-scheme=dark]_&]:bg-[#2A4370] md:block" />
        <div className="flex h-11 min-w-0 items-center gap-2.5 border-t border-[#D3E2E6] px-3.5 [.doccy-profile[data-scheme=dark]_&]:border-[#2A4370] md:h-[42px] md:flex-1 md:border-t-0">
          <MapPin className="h-[17px] w-[17px] shrink-0 text-[#0A6B72] [.doccy-profile[data-scheme=dark]_&]:text-[#7FE6EB]" strokeWidth={2} />
          <span className="truncate text-[15px] font-medium text-site-ink-500">District or town</span>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-[15px] font-bold text-white opacity-80 [.doccy-profile[data-scheme=dark]_&]:bg-clinical-500 [.doccy-profile[data-scheme=dark]_&]:text-[#062F61] md:h-[42px]">
          <Search className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          Search
        </span>
      </div>
    </div>
  );
}
