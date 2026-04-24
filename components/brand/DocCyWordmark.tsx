type DocCyWordmarkProps = {
  className?: string;
};

export function DocCyWordmark({ className = "" }: DocCyWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline text-lg font-semibold leading-none tracking-tight text-slate-50 ${className}`.trim()}
      aria-label="DocCy"
    >
      <span>Doc</span>
      <span className="text-emerald-400">Cy</span>
    </span>
  );
}

