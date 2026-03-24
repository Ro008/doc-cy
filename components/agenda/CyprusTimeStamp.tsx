export function CyprusTimeStamp({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "discreet";
}) {
  if (variant === "discreet") {
    return (
      <p className="text-right text-[10px] leading-tight text-slate-500">
        <span className="mr-1 hidden font-medium uppercase tracking-wider text-slate-600 sm:inline">
          Cyprus
        </span>
        <span className="font-mono tabular-nums text-slate-500">{label}</span>
      </p>
    );
  }

  return (
    <div className="flex items-baseline gap-2 text-xs text-slate-500">
      <span className="hidden font-medium uppercase tracking-wide text-slate-500 sm:inline">
        Cyprus
      </span>
      <span className="font-mono tabular-nums text-[0.8125rem] text-slate-300">
        {label}
      </span>
    </div>
  );
}
