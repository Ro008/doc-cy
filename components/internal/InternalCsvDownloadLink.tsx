"use client";

type Props = {
  href: string;
};

export function InternalCsvDownloadLink({ href }: Props) {
  return (
    <a
      href={href}
      className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-clinical-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-clinical-400 sm:min-h-0"
    >
      Download CSV
    </a>
  );
}
